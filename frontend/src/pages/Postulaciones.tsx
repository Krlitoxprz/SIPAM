import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, FileText, Upload, CheckCircle, XCircle, Clock, AlertTriangle, Loader2, MessageSquare, LogOut, QrCode } from 'lucide-react';
import type { Postulacion, EstadoPostulacion } from '../types';
import { postulacionesService, qrService, downloadBlob } from '../services/api';
import { useAuthContext } from '../context/AuthContext';

const estadoConfig: Record<EstadoPostulacion, { label: string; color: string; icon: React.ReactNode }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: <Clock size={14} /> },
  documentos_incompletos: { label: 'Docs. Incompletos', color: 'bg-orange-100 text-orange-700', icon: <AlertTriangle size={14} /> },
  en_revision: { label: 'En Revisión', color: 'bg-blue-100 text-blue-700', icon: <Clock size={14} /> },
  preseleccionado: { label: 'Preseleccionado', color: 'bg-indigo-100 text-indigo-700', icon: <CheckCircle size={14} /> },
  seleccionado: { label: '✓ Seleccionado', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={14} /> },
  no_seleccionado: { label: 'No Seleccionado', color: 'bg-red-100 text-red-700', icon: <XCircle size={14} /> },
  desistido: { label: 'Desistido', color: 'bg-gray-100 text-gray-600', icon: <XCircle size={14} /> },
};

const TIPOS_DOC = [
  { value: 'cedula', label: 'Cédula de Ciudadanía' },
  { value: 'rut', label: 'RUT' },
  { value: 'certificado_bancario', label: 'Certificado Bancario' },
];

function UploadDocumentoModal({
  postulacionId,
  onClose,
  onSuccess,
}: {
  postulacionId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tipo, setTipo] = useState('cedula');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      await postulacionesService.subirDocumento(postulacionId, tipo, file);
      onSuccess();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail ?? 'Error al subir el documento');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Subir Documento</h3>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tipo de Documento</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-usco-vinotinto"
            >
              {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Archivo PDF</label>
            <input
              type="file"
              accept=".pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-usco-vinotinto"
            />
            <p className="text-xs text-gray-400 mt-1">
              El archivo se guardará como: <code className="bg-gray-100 px-1 rounded">[Código]_{tipo}.pdf</code>
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="flex-1 bg-usco-vinotinto hover:bg-usco-vinotinto-dark text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm flex items-center justify-center gap-2"
          >
            <Upload size={16} />
            {loading ? 'Subiendo...' : 'Subir PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ESTADOS_RETIRABLES: EstadoPostulacion[] = ['pendiente', 'documentos_incompletos', 'en_revision', 'preseleccionado'];

export function Postulaciones() {
  const { user } = useAuthContext();
  const [postulaciones, setPostulaciones] = useState<Postulacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModal, setUploadModal] = useState<number | null>(null);
  const [desistiendo, setDesistiendo] = useState<number | null>(null);

  async function cargar() {
    setLoading(true);
    try {
      const res = await postulacionesService.getMias();
      setPostulaciones(res.data);
    } catch {
      setPostulaciones([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDesistir(post: Postulacion) {
    if (!window.confirm(`¿Seguro que deseas retirar tu postulación de "${post.convocatoria?.titulo}"? Esta acción no se puede deshacer.`)) return;
    setDesistiendo(post.id);
    try {
      await postulacionesService.desistir(post.id);
      cargar();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      alert(err.response?.data?.detail ?? 'No se pudo retirar la postulación.');
    } finally {
      setDesistiendo(null);
    }
  }

  useEffect(() => { cargar(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="animate-spin text-usco-vinotinto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {uploadModal !== null && (
        <UploadDocumentoModal
          postulacionId={uploadModal}
          onClose={() => setUploadModal(null)}
          onSuccess={() => { setUploadModal(null); cargar(); }}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-800">Mis Postulaciones</h1>
        <p className="text-gray-500 mt-1">Estado de tus postulaciones a convocatorias de monitoría.</p>
      </div>

      {postulaciones.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <ClipboardList size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No tienes postulaciones activas</p>
          <p className="text-sm">
            <Link to="/convocatorias" className="text-usco-vinotinto font-semibold hover:underline">Ver convocatorias abiertas</Link>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {postulaciones.map(post => {
            const cfg = estadoConfig[post.estado];
            const archivos = post.archivos ?? [];
            const tiposSubidos = archivos.map((a: { tipo_documento: string }) => a.tipo_documento);
            const faltantes = TIPOS_DOC.filter(t => !tiposSubidos.includes(t.value));
            return (
              <div key={post.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">
                      {post.convocatoria?.titulo ?? `Convocatoria #${post.convocatoria_id}`}
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {post.convocatoria?.asignatura?.nombre} ·{' '}
                      Postulado: {new Date(post.fecha_postulacion).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 ${cfg.color}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">Promedio</p>
                    <p className="font-bold text-gray-800">{post.promedio_estudiante?.toFixed(2) ?? '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">Nota Asignatura</p>
                    <p className="font-bold text-gray-800">{post.nota_asignatura?.toFixed(2) ?? '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">Entrevista</p>
                    <p className="font-bold text-gray-800">{post.nota_entrevista?.toFixed(2) ?? '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">Puntaje Final</p>
                    <p className={`font-bold ${post.puntaje_final ? 'text-usco-vinotinto' : 'text-gray-800'}`}>
                      {post.puntaje_final?.toFixed(4) ?? '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                      <FileText size={15} /> Documentos requeridos
                    </p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${post.documentos_completos ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                      {post.documentos_completos ? 'Completos' : `${archivos.length}/3 subidos`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TIPOS_DOC.map(t => {
                      const subido = tiposSubidos.includes(t.value);
                      return (
                        <div key={t.value} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${subido ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                          {subido ? <CheckCircle size={12} /> : <Upload size={12} />}
                          {t.label}
                        </div>
                      );
                    })}
                  </div>
                  {faltantes.length > 0 && user?.rol === 'estudiante' && !['seleccionado','no_seleccionado','desistido'].includes(post.estado) && (
                    <button
                      onClick={() => setUploadModal(post.id)}
                      className="mt-3 flex items-center gap-2 text-sm font-semibold text-usco-vinotinto hover:text-usco-vinotinto/80 transition-colors"
                    >
                      <Upload size={15} /> Subir documento faltante
                    </button>
                  )}
                  {post.estado === 'seleccionado' && (
                    <button
                      onClick={async () => {
                        try {
                          const r = await qrService.postulacion(post.id);
                          downloadBlob(r.data, `qr_postulacion_${post.id}.png`);
                        } catch { /* silencioso */ }
                      }}
                      className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                    >
                      <QrCode size={13} /> Descargar QR de verificación
                    </button>
                  )}
                  {user?.rol === 'estudiante' && ESTADOS_RETIRABLES.includes(post.estado) && (
                    <button
                      onClick={() => handleDesistir(post)}
                      disabled={desistiendo === post.id}
                      className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      {desistiendo === post.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <LogOut size={13} />}
                      Retirar postulación
                    </button>
                  )}
                  {post.carta_motivacion && (
                    <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2.5">
                      <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                        <MessageSquare size={12} /> Carta de motivación
                      </p>
                      <p className="text-xs text-gray-600 line-clamp-3">{post.carta_motivacion}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
