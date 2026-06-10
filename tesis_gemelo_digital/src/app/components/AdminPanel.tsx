'use client';

import { useState, useEffect } from 'react';
import { executeQuery, executeMutation } from '@/lib/graphql-client';
import { User } from '@/types';
import {
    UserGroupIcon,
    KeyIcon,
    ClipboardDocumentCheckIcon,
    ArrowPathIcon,
    PlusIcon,
    CheckIcon,
    ArrowLeftIcon,
    ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

interface AdminPanelProps {
    currentUser: User;
    onBack?: () => void;
    onLogout?: () => void;
}

interface InvitationCode {
    _id: string;
    code: string;
    role: string;
    isUsed: boolean;
    createdBy?: string;
    usedBy?: string;
    createdAt?: string;
}

const ADMIN_DATA_QUERY = `
  query AdminData {
    users {
      _id
      email
      name
      role
      createdAt
    }
    invitationCodes {
      _id
      code
      role
      isUsed
      createdBy
      usedBy
      createdAt
    }
  }
`;

const GENERATE_CODE_MUTATION = `
  mutation GenerateCode($role: String!, $createdBy: String!) {
    generateInvitationCode(role: $role, createdBy: $createdBy) {
      _id
      code
      role
      isUsed
      createdAt
    }
  }
`;

export default function AdminPanel({ currentUser, onBack, onLogout }: AdminPanelProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [codes, setCodes] = useState<InvitationCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [genError, setGenError] = useState<string | null>(null);

    useEffect(() => {
        if (!copiedCode) return;
        const t = setTimeout(() => setCopiedCode(null), 1500);
        return () => clearTimeout(t);
    }, [copiedCode]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await executeQuery<{ users: User[]; invitationCodes: InvitationCode[] }>(
                ADMIN_DATA_QUERY,
                {},
                'network-only'
            );
            setUsers(data.users);
            setCodes(data.invitationCodes);
        } catch (error) {
            console.error('Error fetching admin data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleGenerateCode = async () => {
        setGenerating(true);
        setGenError(null);
        try {
            await executeMutation(GENERATE_CODE_MUTATION, {
                role: newRole,
                createdBy: currentUser.email,
            });
            await fetchData();
        } catch (error) {
            console.error('Error generating code:', error);
            setGenError('No se pudo generar el código.');
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedCode(text);
        } catch {
            /* si el portapapeles no está disponible, no rompemos la UI */
        }
    };

    if (loading && users.length === 0) {
        return (
            <div className="flex h-96 items-center justify-center">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {onBack && (
                <button
                    onClick={onBack}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Atrás
                </button>
            )}

            {/* Invitation Codes Section */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-50 p-2">
                            <KeyIcon className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Códigos de Invitación</h3>
                            <p className="text-sm text-slate-500">Generar nuevos accesos para operadores o administradores</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
                        <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                            className="bg-transparent px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none"
                        >
                            <option value="user">Rol: Operador</option>
                            <option value="admin">Rol: Admin</option>
                        </select>
                        <button
                            onClick={handleGenerateCode}
                            disabled={generating}
                            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
                        >
                            {generating ? (
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                                <PlusIcon className="h-4 w-4" />
                            )}
                            Generar
                        </button>
                    </div>
                </div>

                {genError && (
                    <p className="mb-4 text-sm text-red-600">{genError}</p>
                )}

                <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="px-4 py-3 font-medium">Código</th>
                                <th className="px-4 py-3 font-medium">Rol Asignado</th>
                                <th className="px-4 py-3 font-medium">Estado</th>
                                <th className="px-4 py-3 font-medium">Creado por</th>
                                <th className="px-4 py-3 font-medium">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {codes.map((code) => (
                                <tr key={code._id} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-3 font-mono font-medium text-slate-700">
                                        <button
                                            onClick={() => copyToClipboard(code.code)}
                                            className="group flex items-center gap-2 hover:text-blue-600"
                                            title="Copiar código"
                                        >
                                            {code.code}
                                            {copiedCode === code.code ? (
                                                <span className="animate-check-pop inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                                    <CheckIcon className="h-4 w-4" />
                                                    Copiado
                                                </span>
                                            ) : (
                                                <ClipboardDocumentCheckIcon className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${code.role === 'admin'
                                                ? 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20'
                                                : 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20'
                                                }`}
                                        >
                                            {code.role === 'admin' ? 'Administrador' : 'Operador'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${code.isUsed
                                                ? 'bg-slate-100 text-slate-600'
                                                : 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
                                                }`}
                                        >
                                            {code.isUsed ? 'Usado' : 'Activo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">{code.createdBy}</td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {code.createdAt ? new Date(code.createdAt).toLocaleDateString() : '-'}
                                    </td>
                                </tr>
                            ))}
                            {codes.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                        No hay códigos generados aún.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Users Section */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center gap-3">
                    <div className="rounded-lg bg-slate-100 p-2">
                        <UserGroupIcon className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">Usuarios Registrados</h3>
                        <p className="text-sm text-slate-500">Listado de personal con acceso al sistema</p>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="px-4 py-3 font-medium">Nombre</th>
                                <th className="px-4 py-3 font-medium">Email</th>
                                <th className="px-4 py-3 font-medium">Rol</th>
                                <th className="px-4 py-3 font-medium">Fecha Registro</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {users.map((user) => (
                                <tr key={user._id} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-3 font-medium text-slate-900">{user.name || '-'}</td>
                                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${user.role === 'admin'
                                                ? 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20'
                                                : 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-600/20'
                                                }`}
                                        >
                                            {user.role === 'admin' ? 'Administrador' : 'Operador'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Zona de cierre de sesión */}
            {onLogout && (
                <div className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-red-700">Cerrar sesión</h3>
                            <p className="mt-0.5 text-sm text-red-600/80">
                                Se cerrará tu sesión en este dispositivo. Tendrás que volver a iniciar sesión para acceder.
                            </p>
                        </div>
                        <button
                            onClick={onLogout}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-600 hover:bg-red-600 hover:text-white"
                        >
                            <ArrowRightOnRectangleIcon className="h-4 w-4" />
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
