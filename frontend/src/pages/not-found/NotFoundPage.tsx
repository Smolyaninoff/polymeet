import { Link } from "react-router-dom";

export function NotFoundPage({ text = "Такой страницы нет" }: { text?: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-lg font-semibold text-white">{text}</p>
      <Link to="/" className="mt-4 inline-block text-sm text-blue-400 hover:text-blue-300">
        К ленте встреч
      </Link>
    </div>
  );
}
