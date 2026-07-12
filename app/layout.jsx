import "./globals.css";

export const metadata = {
  title: "EduTutor",
  description: "AI-powered learning app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
