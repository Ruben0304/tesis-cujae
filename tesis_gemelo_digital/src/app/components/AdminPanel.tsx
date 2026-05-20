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
} from '@heroicons/react/24/outline';

interface AdminPanelProps {
    currentUser: User;
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

export default function AdminPanel({ currentUser }: AdminPanelProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [codes, setCodes] = useState<InvitationCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [newRole, setNewRole] = useState<'user' | 'admin'>('user');

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
        try {
            await executeMutation(GENERATE_CODE_MUTATION, {
                role: newRole,
                createdBy: currentUser.email,
            });
            await fetchData();
        } catch (error) {
            console.error('Error generating code:', error);
            alert('Error al generar el código');
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Could add a toast notification here
    };

    if (loading && users.length === 0) {
        return (
            <div className="flex h-96 items-center justify-center">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Panel de Administración</h2>
                    <p className="text-sm text-slate-500">Gestión de usuarios y códigos de acceso</p>
                </div>
                <button
                    onClick={fetchData}
                    className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                    title="Actualizar datos"
                >
                    <ArrowPathIcon className="h-5 w-5 text-slate-500" />
                </button>
            </div>

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
                                            <ClipboardDocumentCheckIcon className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
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
        </div>
    );
}
