import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '../Switch';

type StepExecutorParams = Record<string, unknown>;

interface ArmConfigPayload {
  enabled?: unknown;
  step_executor_model?: unknown;
  step_executor_params?: unknown;
  max_iterations?: unknown;
}

interface RoboticArmPanelProps {
  isConnected: boolean;
  request: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
}

// SO-101 + ReKep is currently the only registered step_executor_model
// (openjiuwen SubTaskExecutorRegistry). Its constructor params are rendered
// as labeled fields; any other model name falls back to a raw JSON editor
// for step_executor_params so new vendors don't need a frontend change.
const SO101_REKEP_MODEL = 'so101_rekep';

type FieldKind = 'text' | 'password' | 'vec3';

interface FieldSpec {
  key: string;
  labelKey: string;
  kind: FieldKind;
  placeholder?: string;
}

const SO101_REKEP_FIELDS: FieldSpec[] = [
  { key: 'workspace_min', labelKey: 'roboticArm.fields.workspaceMin', kind: 'vec3', placeholder: '0.05, -0.25, -0.05' },
  { key: 'workspace_max', labelKey: 'roboticArm.fields.workspaceMax', kind: 'vec3', placeholder: '0.45, 0.20, 0.30' },
  { key: 'camera_matrix_path', labelKey: 'roboticArm.fields.cameraMatrixPath', kind: 'text' },
  { key: 'depth_scale_path', labelKey: 'roboticArm.fields.depthScalePath', kind: 'text' },
  { key: 'extrinsics_path', labelKey: 'roboticArm.fields.extrinsicsPath', kind: 'text' },
  { key: 'urdf_path', labelKey: 'roboticArm.fields.urdfPath', kind: 'text' },
  { key: 'port', labelKey: 'roboticArm.fields.port', kind: 'text', placeholder: '/dev/tty.usbmodemXXXX' },
  { key: 'sam_checkpoint_path', labelKey: 'roboticArm.fields.samCheckpointPath', kind: 'text' },
  { key: 'vlm_api_key', labelKey: 'roboticArm.fields.vlmApiKey', kind: 'password' },
  { key: 'vlm_model', labelKey: 'roboticArm.fields.vlmModel', kind: 'text', placeholder: 'anthropic/claude-opus-4.8' },
];

function normalizeEnabled(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const data = payload as ArmConfigPayload;
  return typeof data.enabled === 'boolean' ? data.enabled : false;
}

function normalizeModel(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as ArmConfigPayload;
  return typeof data.step_executor_model === 'string' ? data.step_executor_model : '';
}

function normalizeParams(payload: unknown): StepExecutorParams {
  if (!payload || typeof payload !== 'object') return {};
  const data = payload as ArmConfigPayload;
  return data.step_executor_params && typeof data.step_executor_params === 'object'
    ? (data.step_executor_params as StepExecutorParams)
    : {};
}

function normalizeMaxIterations(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as ArmConfigPayload;
  const value = data.max_iterations;
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function vec3ToString(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  return typeof value === 'string' ? value : '';
}

function stringToVec3(value: string): number[] | null {
  const parts = value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length !== 3) return null;
  const nums = parts.map(Number);
  return nums.every((n) => Number.isFinite(n)) ? nums : null;
}

export function RoboticArmPanel({ isConnected, request }: RoboticArmPanelProps) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [initialEnabled, setInitialEnabled] = useState(false);
  const [model, setModel] = useState('');
  const [initialModel, setInitialModel] = useState('');
  const [params, setParams] = useState<StepExecutorParams>({});
  const [initialParams, setInitialParams] = useState<StepExecutorParams>({});
  const [maxIterations, setMaxIterations] = useState('');
  const [initialMaxIterations, setInitialMaxIterations] = useState('');
  const [rawParamsText, setRawParamsText] = useState('{}');
  const [rawParamsError, setRawParamsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isKnownVendor = model.trim() === SO101_REKEP_MODEL;

  const hasChanges = useMemo(() => {
    if (enabled !== initialEnabled) return true;
    if (model !== initialModel) return true;
    if (maxIterations !== initialMaxIterations) return true;
    if (!isKnownVendor) {
      return rawParamsText !== JSON.stringify(initialParams, null, 2);
    }
    return JSON.stringify(params) !== JSON.stringify(initialParams);
  }, [
    enabled,
    initialEnabled,
    model,
    initialModel,
    maxIterations,
    initialMaxIterations,
    params,
    initialParams,
    isKnownVendor,
    rawParamsText,
  ]);

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const loadConfig = useCallback(async () => {
    setLoading(true);
    clearFeedback();
    try {
      const payload = await request<ArmConfigPayload>('arm.get_config');
      const nextEnabled = normalizeEnabled(payload);
      const nextModel = normalizeModel(payload);
      const nextParams = normalizeParams(payload);
      const nextMaxIterations = normalizeMaxIterations(payload);
      setEnabled(nextEnabled);
      setInitialEnabled(nextEnabled);
      setModel(nextModel);
      setInitialModel(nextModel);
      setParams(nextParams);
      setInitialParams(nextParams);
      setMaxIterations(nextMaxIterations);
      setInitialMaxIterations(nextMaxIterations);
      setRawParamsText(JSON.stringify(nextParams, null, 2));
      setRawParamsError(null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : t('roboticArm.errors.loadConfig');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [request, t]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 2500);
    return () => window.clearTimeout(timer);
  }, [success]);

  const updateField = (key: string, value: unknown) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    if (error) setError(null);
  };

  // Keep the structured-field state and the raw-JSON editor in sync when the
  // user switches step_executor_model between a known and unknown vendor, so
  // edits made in one view aren't silently lost when the other is shown.
  const handleModelChange = (nextModel: string) => {
    const wasKnownVendor = isKnownVendor;
    const willBeKnownVendor = nextModel.trim() === SO101_REKEP_MODEL;
    if (wasKnownVendor && !willBeKnownVendor) {
      setRawParamsText(JSON.stringify(params, null, 2));
      setRawParamsError(null);
    } else if (!wasKnownVendor && willBeKnownVendor) {
      try {
        const parsed = JSON.parse(rawParamsText || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setParams(parsed as StepExecutorParams);
        }
      } catch {
        // Leave params untouched; the raw text was never valid JSON to begin with.
      }
    }
    setModel(nextModel);
    if (error) setError(null);
  };

  const handleSave = async () => {
    if (saving || !hasChanges || !isConnected) return;

    let paramsToSave = params;
    if (!isKnownVendor) {
      try {
        const parsed = JSON.parse(rawParamsText || '{}');
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('must be a JSON object');
        }
        paramsToSave = parsed as StepExecutorParams;
        setRawParamsError(null);
      } catch (parseError) {
        setRawParamsError(
          parseError instanceof Error ? parseError.message : t('roboticArm.errors.invalidParamsJson')
        );
        return;
      }
    }

    const trimmedModel = model.trim();
    if (enabled && !trimmedModel) {
      setError(t('roboticArm.errors.modelRequired'));
      return;
    }

    setSaving(true);
    clearFeedback();
    try {
      const body: Record<string, unknown> = {
        enabled,
        step_executor_model: trimmedModel,
        step_executor_params: paramsToSave,
      };
      const parsedMaxIterations = Number(maxIterations);
      if (maxIterations.trim() !== '' && Number.isFinite(parsedMaxIterations)) {
        body.max_iterations = parsedMaxIterations;
      }
      const payload = await request<ArmConfigPayload>('arm.set_config', body);
      const savedEnabled = normalizeEnabled(payload);
      const savedModel = normalizeModel(payload);
      const savedParams = normalizeParams(payload);
      const savedMaxIterations = normalizeMaxIterations(payload);
      setEnabled(savedEnabled);
      setInitialEnabled(savedEnabled);
      setModel(savedModel);
      setInitialModel(savedModel);
      setParams(savedParams);
      setInitialParams(savedParams);
      setRawParamsText(JSON.stringify(savedParams, null, 2));
      setMaxIterations(savedMaxIterations);
      setInitialMaxIterations(savedMaxIterations);
      setSuccess(t('roboticArm.success.saved'));
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : t('roboticArm.errors.saveConfig');
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEnabled(initialEnabled);
    setModel(initialModel);
    setParams(initialParams);
    setRawParamsText(JSON.stringify(initialParams, null, 2));
    setMaxIterations(initialMaxIterations);
    setRawParamsError(null);
    clearFeedback();
  };

  return (
    <div className="flex-1 min-h-0">
      <div className="card w-full h-full flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold">{t('roboticArm.title')}</h2>
            <p className="text-sm text-text-muted mt-1">{t('roboticArm.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadConfig()}
            disabled={saving || loading}
            className="btn !px-3 !py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('common.refreshing') : t('roboticArm.refresh')}
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-[var(--border-danger)] bg-danger-subtle px-3 py-2 text-sm text-danger">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mb-4 rounded-md border border-[var(--border-ok)] bg-ok-subtle px-3 py-2 text-sm text-ok">
            {success}
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-card/70 backdrop-blur-sm overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
            <span className="text-xs text-text-muted tracking-wider font-medium">{t('roboticArm.sectionTitle')}</span>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-4 py-1">
              <div>
                <span className="text-xs uppercase tracking-wide text-text-muted">{t('roboticArm.enable')}</span>
                <p className="text-xs text-text-muted mt-0.5">{t('roboticArm.enableDesc')}</p>
              </div>
              <Switch checked={enabled} onChange={setEnabled} disabled={loading || saving} />
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs uppercase tracking-wide text-text-muted">step_executor_model</span>
              <input
                type="text"
                value={model}
                onChange={(event) => handleModelChange(event.target.value)}
                placeholder={SO101_REKEP_MODEL}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-text outline-none focus:border-accent"
                disabled={loading || saving}
              />
              <span className="text-xs text-text-muted">{t('roboticArm.modelHelp')}</span>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs uppercase tracking-wide text-text-muted">max_iterations</span>
              <input
                type="number"
                min={1}
                value={maxIterations}
                onChange={(event) => setMaxIterations(event.target.value)}
                placeholder="30"
                className="w-full max-w-[160px] rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-text outline-none focus:border-accent"
                disabled={loading || saving}
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/70 backdrop-blur-sm overflow-hidden shadow-sm mt-4">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <span className="text-xs text-text-muted tracking-wider font-medium">
              {t('roboticArm.paramsSectionTitle')}
            </span>
          </div>
          <div className="p-4 space-y-4">
            {isKnownVendor ? (
              SO101_REKEP_FIELDS.map((field) => (
                <label key={field.key} className="block space-y-1.5">
                  <span className="text-xs uppercase tracking-wide text-text-muted">{t(field.labelKey)}</span>
                  {field.kind === 'vec3' ? (
                    <input
                      type="text"
                      value={vec3ToString(params[field.key])}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const parsed = stringToVec3(raw);
                        updateField(field.key, parsed ?? raw);
                      }}
                      placeholder={field.placeholder}
                      className="w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-text outline-none focus:border-accent"
                      disabled={loading || saving}
                    />
                  ) : (
                    <input
                      type={field.kind === 'password' ? 'password' : 'text'}
                      value={typeof params[field.key] === 'string' ? (params[field.key] as string) : ''}
                      onChange={(event) => updateField(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      className="w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-text outline-none focus:border-accent"
                      disabled={loading || saving}
                    />
                  )}
                </label>
              ))
            ) : (
              <label className="block space-y-1.5">
                <span className="text-xs uppercase tracking-wide text-text-muted">
                  {t('roboticArm.rawParamsLabel')}
                </span>
                <textarea
                  value={rawParamsText}
                  onChange={(event) => {
                    setRawParamsText(event.target.value);
                    if (rawParamsError) setRawParamsError(null);
                  }}
                  rows={10}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] font-mono text-text outline-none focus:border-accent"
                  disabled={loading || saving}
                />
                {rawParamsError ? <div className="text-xs text-danger">{rawParamsError}</div> : null}
                <span className="text-xs text-text-muted">{t('roboticArm.rawParamsHelp')}</span>
              </label>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            className="btn !px-3 !py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleCancel}
            disabled={!hasChanges || saving}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn primary !px-3 !py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => void handleSave()}
            disabled={!isConnected || !hasChanges || saving || loading}
          >
            {saving ? t('common.saving') : t('roboticArm.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
