from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    OPTIONAL_AUTH,
    CurrentUser,
    OptionalUser,
    RedisDep,
    SessionDep,
    SettingsDep,
    get_geocoding,
)
from app.api.errors import (
    ForbiddenError,
    InvalidTransitionError,
    NotFoundError,
    UnauthorizedError,
    ValidationAppError,
    error_responses,
)
from app.api.v1.applications import ApplicationServiceDep
from app.api.v1.mappers import to_meeting_list_item, to_meeting_out, to_my_application_out
from app.api.v1.params import Cursor, MeetingId, p95
from app.schemas.meetings import (
    CategorySlug,
    LocationIn,
    MeetingCreate,
    MeetingListItem,
    MeetingOut,
    MeetingPage,
    MeetingUpdate,
)
from app.services.feed_cache import FeedCache
from app.services.feed_service import FeedService
from app.services.geocoding_port import GeocodingPort
from app.services.meeting_service import MeetingService

router = APIRouter(prefix="/meetings", tags=["meetings"])


def get_feed_cache(redis: RedisDep, settings: SettingsDep) -> FeedCache:
    return FeedCache(redis, settings.feed_cache_ttl_sec)


FeedCacheDep = Annotated[FeedCache, Depends(get_feed_cache)]


def get_meeting_service(
    session: SessionDep,
    geocoding: Annotated[GeocodingPort, Depends(get_geocoding)],
    feed_cache: FeedCacheDep,
) -> MeetingService:
    return MeetingService(session, geocoding, feed_cache)


MeetingServiceDep = Annotated[MeetingService, Depends(get_meeting_service)]


def get_feed_service(
    session: SessionDep, settings: SettingsDep, feed_cache: FeedCacheDep
) -> FeedService:
    return FeedService(session, settings.app_timezone, feed_cache)


FeedServiceDep = Annotated[FeedService, Depends(get_feed_service)]

BBOX_PATTERN = r"^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$"

CategoryFilter = Annotated[CategorySlug | None, Query(description="slug категории")]
DateFilter = Annotated[
    date | None,
    Query(alias="date", description="День начала встречи (`YYYY-MM-DD`) по времени Москвы"),
]
FreePlacesFilter = Annotated[bool, Query(description="Только встречи со свободными местами")]


@router.get(
    "",
    summary="Лента встреч",
    description=p95(
        200,
        "Опубликованные будущие встречи по времени начала. "
        "`lat`, `lon` и `radius_km` задаются только вместе; тогда в ответе есть `distance_km`.",
    ),
    openapi_extra=OPTIONAL_AUTH,
    responses=error_responses(ValidationAppError, UnauthorizedError),
)
async def list_meetings(
    viewer: OptionalUser,
    service: FeedServiceDep,
    category: CategoryFilter = None,
    day: DateFilter = None,
    lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
    lon: Annotated[float | None, Query(ge=-180, le=180)] = None,
    radius_km: Annotated[float | None, Query(ge=1, le=50, description="Радиус, км")] = None,
    has_free_places: FreePlacesFilter = False,
    q: Annotated[str | None, Query(min_length=1, max_length=100, description="Поиск")] = None,
    cursor: Cursor = None,
    limit: Annotated[int, Query(ge=1, le=20, description="Размер страницы")] = 20,
) -> MeetingPage:
    return await service.list_feed(
        category=category,
        day=day,
        lat=lat,
        lon=lon,
        radius_km=radius_km,
        has_free_places=has_free_places,
        q=q,
        cursor=cursor,
        limit=limit,
        build_item=to_meeting_list_item,
    )


@router.get(
    "/map",
    summary="Встречи на карте",
    description=p95(
        200,
        "Опубликованные будущие встречи с координатами внутри видимой области карты, "
        "по времени начала, без пагинации.",
    ),
    openapi_extra=OPTIONAL_AUTH,
    responses=error_responses(ValidationAppError, UnauthorizedError),
)
async def list_meetings_on_map(
    viewer: OptionalUser,
    service: FeedServiceDep,
    bbox: Annotated[
        str,
        Query(
            pattern=BBOX_PATTERN,
            description="Видимая область: `min_lon,min_lat,max_lon,max_lat`",
            examples=["30.25,59.90,30.45,60.05"],
        ),
    ],
    category: CategoryFilter = None,
    day: DateFilter = None,
    has_free_places: FreePlacesFilter = False,
    limit: Annotated[int, Query(ge=1, le=200, description="Максимум точек")] = 200,
) -> list[MeetingListItem]:
    return await service.list_on_map(
        bbox=bbox,
        category=category,
        day=day,
        has_free_places=has_free_places,
        limit=limit,
        build_item=to_meeting_list_item,
    )


@router.post(
    "",
    status_code=201,
    summary="Создание встречи",
    description=p95(
        300,
        "Встреча создаётся черновиком. Адрес геокодируется в фоне: "
        "пока координат нет, `geo_status` равен `pending`.",
    ),
    responses=error_responses(ValidationAppError, UnauthorizedError),
)
async def create_meeting(
    payload: MeetingCreate, user: CurrentUser, service: MeetingServiceDep
) -> MeetingOut:
    return to_meeting_out(await service.create(user, payload))


@router.get(
    "/{meeting_id}",
    summary="Карточка встречи",
    description=p95(150, "Черновик виден только организатору; для остальных — 404."),
    openapi_extra=OPTIONAL_AUTH,
    responses=error_responses(ValidationAppError, UnauthorizedError, NotFoundError),
)
async def get_meeting(
    meeting_id: MeetingId,
    viewer: OptionalUser,
    service: MeetingServiceDep,
    applications: ApplicationServiceDep,
) -> MeetingOut:
    meeting = await service.get(meeting_id, viewer)
    my_application = None
    if viewer is not None and viewer.id != meeting.organizer_id:
        application = await applications.get_my_application(meeting.id, viewer)
        if application is not None:
            my_application = to_my_application_out(application)
    return to_meeting_out(meeting, my_application)


@router.patch(
    "/{meeting_id}",
    summary="Правка, публикация, отмена",
    description=p95(
        300,
        "Только организатор. Переходы статуса: `draft → published`, `draft → cancelled`, "
        "`published → cancelled`. Отменённую встречу менять нельзя.",
    ),
    responses=error_responses(
        ValidationAppError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        InvalidTransitionError,
    ),
)
async def update_meeting(
    meeting_id: MeetingId, payload: MeetingUpdate, user: CurrentUser, service: MeetingServiceDep
) -> MeetingOut:
    return to_meeting_out(
        await service.update(meeting_id, user, payload.model_dump(exclude_unset=True))
    )


@router.put(
    "/{meeting_id}/location",
    summary="Точка на карте вручную",
    description=p95(
        300, "Только организатор, не для отменённых встреч. `geo_status` становится `manual`."
    ),
    responses=error_responses(
        ValidationAppError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        InvalidTransitionError,
    ),
)
async def set_meeting_location(
    meeting_id: MeetingId, payload: LocationIn, user: CurrentUser, service: MeetingServiceDep
) -> MeetingOut:
    return to_meeting_out(await service.set_location(meeting_id, user, payload.lat, payload.lon))
