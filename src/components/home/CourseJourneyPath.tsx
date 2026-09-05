/**
 * Trilha Meu Curso — composição da referência:
 * linha vertical + cards compactos (done/locked) + card atual dominante.
 * Só apresentação; handlers vêm do CoursePage.
 */
import type { ReactNode } from 'react';
import { IconLock, IconCheck, IconPlay } from '@/components/ui/Icons';

export type JourneyNodeStatus = 'done' | 'current' | 'locked' | 'available';

export function CourseJourneyPath({
  nodes,
}: {
  nodes: Array<{
    id: string;
    title: string;
    blurb?: string;
    status: JourneyNodeStatus;
    percent: number | null;
    onContinue?: () => void;
    onOpenDetails?: () => void;
    continueLabel?: string;
    children?: ReactNode;
  }>;
}) {
  return (
    <section aria-label="Jornada L0 a C2" className="relative px-0">
      <ol className="relative flex flex-col gap-2.5">
        {nodes.map((node, i) => {
          const isLast = i === nodes.length - 1;
          const done = node.status === 'done';
          const current = node.status === 'current';
          const locked = node.status === 'locked';
          const nodeSize = current ? 44 : 34;

          return (
            <li key={node.id} className="relative flex gap-3 items-stretch">
              {/* Spine */}
              <div className="relative flex flex-col items-center w-11 shrink-0">
                <span
                  className="relative z-[1] rounded-full flex items-center justify-center font-extrabold shrink-0"
                  style={{
                    width: nodeSize,
                    height: nodeSize,
                    fontSize: current ? 13 : 11,
                    ...(current
                      ? {
                          background: 'linear-gradient(145deg, #00F2FE, #3A7BD5)',
                          color: '#0B0F19',
                          boxShadow:
                            '0 0 0 5px rgba(0,242,254,0.2), 0 0 28px rgba(0,242,254,0.55)',
                        }
                      : done
                        ? {
                            background: 'var(--learning-violet)',
                            color: '#fff',
                            boxShadow: '0 0 14px rgba(139,92,246,0.4)',
                          }
                        : {
                            background: 'rgba(23,32,51,0.9)',
                            color: 'var(--text-faint)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            opacity: 0.75,
                          }),
                  }}
                  aria-hidden
                >
                  {node.id}
                </span>
                {!isLast ? (
                  <span
                    aria-hidden
                    className="flex-1 w-[2px] mt-1.5 min-h-[12px]"
                    style={{
                      background: done || current
                        ? 'linear-gradient(180deg, var(--learning-violet), var(--voice-cyan))'
                        : 'repeating-linear-gradient(180deg, rgba(255,255,255,0.14) 0 3px, transparent 3px 7px)',
                      opacity: locked ? 0.45 : 1,
                    }}
                  />
                ) : null}
              </div>

              {/* Card */}
              <div
                className={`min-w-0 flex-1 ${current ? 'mb-1' : ''}`}
                style={{
                  borderRadius: current ? 22 : 18,
                  padding: current ? '14px 14px 14px 14px' : '11px 12px',
                  background: current
                    ? 'color-mix(in srgb, rgba(0,217,255,0.1) 35%, rgba(15,23,42,0.88))'
                    : 'rgba(15,23,42,0.55)',
                  border: current
                    ? '1.5px solid rgba(0,242,254,0.55)'
                    : '1px solid rgba(255,255,255,0.07)',
                  boxShadow: current
                    ? '0 0 0 1px rgba(0,242,254,0.12), 0 0 32px rgba(0,242,254,0.18), inset 3px 0 12px rgba(0,242,254,0.12)'
                    : 'none',
                  backdropFilter: 'blur(14px)',
                  opacity: locked ? 0.62 : 1,
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {current ? (
                      <>
                        <p className="text-[16px] font-extrabold text-[var(--text-primary)] leading-tight">
                          {node.id}
                          <span className="font-semibold text-[var(--text-secondary)]">
                            {' '}
                            · {node.title}
                          </span>
                        </p>
                        {node.blurb ? (
                          <p className="mt-1.5 text-[13px] text-[var(--text-secondary)] leading-snug">
                            {node.blurb}
                          </p>
                        ) : null}
                        {node.percent != null ? (
                          <div className="mt-3 flex items-center gap-2.5">
                            <div
                              className="flex-1 h-[6px] rounded-full overflow-hidden"
                              style={{ background: 'rgba(255,255,255,0.1)' }}
                              role="progressbar"
                              aria-valuenow={node.percent}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`Progresso ${node.id}`}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.max(0, node.percent))}%`,
                                  background: 'linear-gradient(90deg, #00F2FE, #3A7BD5)',
                                  boxShadow: '0 0 8px rgba(0,242,254,0.5)',
                                }}
                              />
                            </div>
                            <span className="text-[12px] font-bold text-[var(--voice-cyan)] tabular-nums shrink-0">
                              {node.percent}%
                            </span>
                          </div>
                        ) : null}
                        {node.onContinue ? (
                          <button
                            type="button"
                            onClick={node.onContinue}
                            aria-label={node.continueLabel || 'Continuar treino'}
                            data-testid="jornada-primary-cta"
                            className="mt-3.5 w-full min-h-[48px] rounded-[16px] flex items-center justify-between gap-2 px-4 font-extrabold text-[15px] text-white active:scale-[0.98] transition-transform"
                            style={{
                              background:
                                'linear-gradient(135deg, var(--active-coral) 0%, var(--warm-orange) 100%)',
                              boxShadow: '0 10px 28px rgba(255,107,95,0.42)',
                            }}
                          >
                            <span>{node.continueLabel || 'Continuar treino'}</span>
                            <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                              <IconPlay size={14} />
                            </span>
                          </button>
                        ) : null}
                        {node.onOpenDetails ? (
                          <button
                            type="button"
                            onClick={node.onOpenDetails}
                            className="mt-2 text-[12px] font-semibold text-[var(--voice-cyan)] min-h-9"
                          >
                            Ver detalhes do módulo →
                          </button>
                        ) : null}
                        {node.children}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 min-h-[28px]">
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-[14px] font-semibold leading-tight ${
                              locked ? 'text-[var(--text-faint)]' : 'text-[var(--text-secondary)]'
                            }`}
                          >
                            {node.title}
                          </p>
                          <p className="text-[12px] text-[var(--text-faint)] mt-0.5">
                            {node.id}
                            {done && node.percent != null ? ` · ${node.percent}%` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-[var(--text-faint)]" aria-hidden>
                          {locked ? <IconLock size={14} /> : done ? <IconCheck size={16} /> : null}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
