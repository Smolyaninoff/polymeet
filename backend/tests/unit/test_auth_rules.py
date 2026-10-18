import pytest

from app.core.errors import ValidationAppError
from app.services.auth_service import (
    check_email_domain,
    check_password,
    normalize_display_name,
    normalize_email,
)


def _invalid_field(error: pytest.ExceptionInfo[ValidationAppError]) -> str:
    assert error.value.details is not None
    [detail] = error.value.details
    return str(detail["field"])


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Anya@EDU.SPbSTU.ru", "anya@edu.spbstu.ru"),
        ("  anya@edu.spbstu.ru\t", "anya@edu.spbstu.ru"),
        ("ANYA@GMAIL.COM ", "anya@gmail.com"),
    ],
)
def test_email_is_lowercased_and_trimmed(raw: str, expected: str) -> None:
    assert normalize_email(raw) == expected


@pytest.mark.parametrize(
    ("email", "allowed"),
    [
        ("anya@gmail.com", []),
        ("anya@edu.spbstu.ru", ["spbstu.ru", "edu.spbstu.ru"]),
    ],
)
def test_email_domain_accepted(email: str, allowed: list[str]) -> None:
    check_email_domain(email, allowed)


@pytest.mark.parametrize(
    "email",
    [
        "anya@gmail.com",
        # Совпадение домена точное: ни поддомены, ни «похожие» имена не проходят
        "anya@edu.spbstu.ru",
        "anya@notspbstu.ru",
        "spbstu.ru@gmail.com",
    ],
)
def test_email_domain_outside_allow_list_is_rejected(email: str) -> None:
    with pytest.raises(ValidationAppError) as error:
        check_email_domain(email, ["spbstu.ru"])

    assert _invalid_field(error) == "email"


@pytest.mark.parametrize(
    "password", ["anya@edu.spbstu.ru", "ANYA@edu.spbstu.ru", " anya@edu.spbstu.ru "]
)
def test_password_equal_to_email_is_rejected(password: str) -> None:
    with pytest.raises(ValidationAppError) as error:
        check_password(password, "anya@edu.spbstu.ru")

    assert _invalid_field(error) == "password"


def test_password_containing_email_is_allowed() -> None:
    check_password("anya@edu.spbstu.ru!", "anya@edu.spbstu.ru")


def test_display_name_is_trimmed() -> None:
    assert normalize_display_name("  Аня  ") == "Аня"


@pytest.mark.parametrize("name", ["  Я  ", "\t\n  ", " x"])
def test_display_name_too_short_after_trim_is_rejected(name: str) -> None:
    with pytest.raises(ValidationAppError) as error:
        normalize_display_name(name)

    assert _invalid_field(error) == "display_name"
