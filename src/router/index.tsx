import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "../hooks/useAuth";
import MainLayout from "../layouts/MainLayout";
import AlertasList from "../pages/Alertas/List";
import ComingSoon from "../pages/ComingSoon";
import Dashboard from "../pages/Dashboard";
import Login from "../pages/Login";
import RolesPermissionsPage from "../pages/Admin/RolesPermissions";
import Users from "../pages/Admin/Users";
import ContratosList from "../pages/Contratos/List";
import FacturasList from "../pages/Facturas/List";
import LeasingComputadorasList from "../pages/Leasing/Computadoras";
import LeasingImpresoras from "../pages/Leasing/Impresoras";
import LicenciasList from "../pages/Licencias/List";
import PagosMensualesList from "../pages/PagosMensuales/List";
import PresupuestoList from "../pages/Presupuesto/List";
import SolpedsList from "../pages/Solpeds/List";
import ProtectedRoute from "./ProtectedRoute";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/solpeds" element={<SolpedsList />} />
            <Route path="/contratos" element={<ContratosList />} />
            <Route path="/pagos-mensuales" element={<PagosMensualesList />} />
            <Route path="/licencias" element={<LicenciasList />} />
            <Route path="/leasing/computadoras" element={<LeasingComputadorasList />} />
            <Route path="/leasing/impresoras" element={<LeasingImpresoras />} />
            <Route path="/presupuesto" element={<PresupuestoList />} />
            <Route path="/facturas" element={<FacturasList />} />
            <Route path="/alertas" element={<AlertasList />} />
            <Route path="/admin/usuarios" element={<Users />} />
            <Route path="/admin/roles" element={<RolesPermissionsPage />} />
            <Route path="/admin/auditoria" element={<ComingSoon moduleName="Auditoría" phase="Fase 13" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
