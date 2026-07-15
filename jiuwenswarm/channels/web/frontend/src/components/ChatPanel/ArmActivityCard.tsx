/**
 * ArmActivityCard 组件
 *
 * 展示机械臂子代理的实时运行状态：report_plan 的子任务列表 + 最新拍到的照片。
 * 数据来自 arm.photo / arm.step_updated 两个 WS 事件（见 useWebSocket.ts），
 * 渲染位置与 SubtaskProgress 一致，挂在消息列表下方、输入框上方。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useChatStore } from '../../stores';
import type { ArmSubTask } from '../../types';

export function ArmActivityCard() {
  const { t } = useTranslation();
  const activeSessionId = useChatStore((state) => state.activeSessionId);
  const armStatus = useChatStore((state) => state.runtimes[activeSessionId ?? '']?.armStatus ?? null);
  const clearArmStatus = useChatStore((state) => state.clearArmStatus);
  const [photoExpanded, setPhotoExpanded] = useState(false);

  if (!armStatus || !activeSessionId) {
    return null;
  }

  const { subTasks, resultText, debugImageBase64, photos } = armStatus;
  const latestPhoto = photos[photos.length - 1] ?? null;
  // 优先展示带关键点标注的调试叠加图（如果 executor 提供了），否则展示原始照片。
  const displayImageBase64 = debugImageBase64 || latestPhoto?.imageBase64 || null;

  return (
    <div className="mx-4 my-2 p-3 bg-accent-subtle rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-info animate-pulse flex-shrink-0" />
          <span className="text-sm font-medium text-text-strong truncate">
            {t('chatUi.arm.title')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => clearArmStatus(activeSessionId)}
          className="text-xs text-text-muted hover:text-text flex-shrink-0"
        >
          {t('common.dismiss')}
        </button>
      </div>

      <div className="flex gap-3 items-start">
        {displayImageBase64 && (
          <button
            type="button"
            onClick={() => setPhotoExpanded((v) => !v)}
            className={clsx(
              'flex-shrink-0 rounded-md overflow-hidden border border-border bg-bg',
              photoExpanded ? 'w-full max-w-[360px]' : 'w-24 h-24'
            )}
            title={t('chatUi.arm.photoHint')}
          >
            <img
              src={`data:image/jpeg;base64,${displayImageBase64}`}
              alt={t('chatUi.arm.latestPhotoAlt')}
              className={clsx('w-full h-full', photoExpanded ? 'object-contain' : 'object-cover')}
            />
          </button>
        )}

        <div className="flex-1 min-w-0 space-y-1.5">
          {subTasks.length === 0 ? (
            <div className="text-sm text-text-muted">{t('chatUi.arm.waitingForPlan')}</div>
          ) : (
            subTasks.map((task) => <ArmSubTaskRow key={task.id} task={task} />)
          )}
          {resultText && (
            <div className="text-xs text-text-muted pt-1 border-t border-border mt-1.5">
              {resultText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArmSubTaskRow({ task }: { task: ArmSubTask }) {
  const { t } = useTranslation();

  const statusIcon = () => {
    switch (task.status) {
      case 'in_progress':
        return <span className="w-3 h-3 rounded-full bg-warning animate-pulse flex-shrink-0" />;
      case 'done':
        return <span className="w-3 h-3 rounded-full bg-ok flex-shrink-0" />;
      case 'failed':
        return <span className="w-3 h-3 rounded-full bg-danger flex-shrink-0" />;
      default:
        return <span className="w-3 h-3 rounded-full border border-border-strong flex-shrink-0" />;
    }
  };

  const statusLabel = () => {
    switch (task.status) {
      case 'in_progress':
        return t('chatUi.arm.status.inProgress');
      case 'done':
        return t('chatUi.arm.status.done');
      case 'failed':
        return t('chatUi.arm.status.failed');
      default:
        return t('chatUi.arm.status.pending');
    }
  };

  return (
    <div
      className={clsx(
        'flex items-start gap-2 py-1 px-2 rounded text-sm',
        task.status === 'in_progress' && 'bg-warning/10'
      )}
    >
      {statusIcon()}
      <div className="flex-1 min-w-0">
        <div className="text-text-strong truncate">{task.description}</div>
      </div>
      <span className="text-text-muted text-xs px-1.5 py-0.5 bg-secondary rounded flex-shrink-0">
        {statusLabel()}
      </span>
    </div>
  );
}
