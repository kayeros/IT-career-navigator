import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CookieBar } from "./CookieBar";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { LoadingLabel } from "./Skeleton";
import { ToastProvider } from "./ToastProvider";
import { VerifyBanner } from "./VerifyBanner";

export function Layout() {
  const { pathname } = useLocation();

  // При переходе на другую страницу начинаем сверху (якоря внутри страницы не трогаем)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <ToastProvider>
      <a href="#main" className="skip-link">
        Перейти к содержанию
      </a>
      <Header />
      <VerifyBanner />
      <main id="main">
        <div className="wrap" id="app">
          <Suspense fallback={<LoadingLabel />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <Footer />
      <CookieBar />
    </ToastProvider>
  );
}
