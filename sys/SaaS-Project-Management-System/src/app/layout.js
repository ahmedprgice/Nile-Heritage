import "./globals.css";
import GlobalThemeToggle from "./components/GlobalThemeToggle";

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className="light-theme" suppressHydrationWarning>
        <GlobalThemeToggle />
        {children}
      </body>
    </html>
  );
}
