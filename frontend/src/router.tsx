import { lazy, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./features/auth/RequireAuth";

// Бандл делим по маршрутам
const HomePage = lazy(() => import("./pages/HomePage"));
const CatalogPage = lazy(() => import("./pages/CatalogPage"));
const ProfessionPage = lazy(() => import("./pages/ProfessionPage"));
const AssessPage = lazy(() => import("./pages/AssessPage"));
const ReportPage = lazy(() => import("./pages/ReportPage"));
const PlanPage = lazy(() => import("./pages/PlanPage"));
const MyPlanRedirect = lazy(() =>
  import("./pages/PlanPage").then((m) => ({ default: m.MyPlanRedirect })),
);
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ResetPage = lazy(() => import("./pages/ResetPage"));
const NewPasswordPage = lazy(() => import("./pages/NewPasswordPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminIndex = lazy(() =>
  import("./pages/admin/WaitlistAdmin").then((m) => ({ default: m.AdminIndex })),
);
const ProfessionsAdmin = lazy(() => import("./pages/admin/ProfessionsAdmin"));
const ProfessionContentAdmin = lazy(() => import("./pages/admin/ProfessionContentAdmin"));
const TopicsAdmin = lazy(() => import("./pages/admin/TopicsAdmin"));
const SkillsAdmin = lazy(() => import("./pages/admin/SkillsAdmin"));
const ResourcesAdmin = lazy(() => import("./pages/admin/ResourcesAdmin"));
const TermsAdmin = lazy(() => import("./pages/admin/TermsAdmin"));
const WaitlistAdmin = lazy(() => import("./pages/admin/WaitlistAdmin"));
const QuizPage = lazy(() => import("./pages/QuizPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

const auth = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>;

export const routes = [
  {
    element: <Layout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/professions", element: <CatalogPage /> },
      { path: "/professions/:slug", element: <ProfessionPage /> },
      { path: "/professions/:slug/assess", element: auth(<AssessPage />) },
      { path: "/professions/:slug/report", element: auth(<ReportPage />) },
      { path: "/professions/:slug/plan", element: auth(<PlanPage />) },
      { path: "/plan", element: auth(<MyPlanRedirect />) },
      { path: "/onboarding", element: auth(<OnboardingPage />) },
      { path: "/dashboard", element: auth(<DashboardPage />) },
      { path: "/profile", element: auth(<ProfilePage />) },
      {
        path: "/admin",
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminIndex /> },
          { path: "professions", element: <ProfessionsAdmin /> },
          { path: "professions/:id", element: <ProfessionContentAdmin /> },
          { path: "topics", element: <TopicsAdmin /> },
          { path: "skills", element: <SkillsAdmin /> },
          { path: "resources", element: <ResourcesAdmin /> },
          { path: "terms", element: <TermsAdmin /> },
          { path: "waitlist", element: <WaitlistAdmin /> },
        ],
      },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/reset", element: <ResetPage /> },
      { path: "/reset-password", element: <NewPasswordPage /> },
      { path: "/verify-email", element: <VerifyEmailPage /> },
      { path: "/quiz", element: <QuizPage /> },
      { path: "/privacy", element: <PrivacyPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const createRouter = () =>
  createBrowserRouter(routes, { future: { v7_relativeSplatPath: true } });
