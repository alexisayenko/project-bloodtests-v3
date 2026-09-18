import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { pressable } from '../primitives/styles';
import { COLOR, RADIUS } from '../../styles/tokens';

export interface PanelRangePickerProps {
  /**
   * Calendar years available with report counts: { [year: number]: count }.
   * Approximated from panel draw dates in presentational mode.
   */
  yearCounts: Record<number, number>;
}

type EdgeType = 'start' | 'end';

function resolveEdgeType(isStart: boolean, isEnd: boolean): EdgeType | null {
  if (isStart) return 'start';
  if (isEnd) return 'end';
  return null;
}

function getCountBadge(count: number): { label: string; fontWeight: number; color: string } {
  if (count > 0) {
    return { label: String(count), fontWeight: 600, color: COLOR.navy };
  }
  return { label: '', fontWeight: 400, color: 'transparent' };
}

function formatYearTickTitle(year: number, count: number): string {
  return `${year}: ${count} report${count === 1 ? '' : 's'}`;
}

function getYearLabelStyle(isSelected: boolean): { color: string; fontWeight: number } {
  if (isSelected) {
    return { color: COLOR.navy, fontWeight: 600 };
  }
  return { color: COLOR.textMuted, fontWeight: 400 };
}

function getHandleStyle(isThisDragging: boolean): React.CSSProperties {
  return {
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: isThisDragging ? '#0070e0' : '#1a88f8',
    border: '2.5px solid #ffffff',
    boxShadow: isThisDragging
      ? '0 0 0 3px rgba(26, 136, 248, 0.35), 0 2px 6px rgba(26, 136, 248, 0.5)'
      : '0 1px 4px rgba(26, 136, 248, 0.4)',
    cursor: 'ew-resize',
    touchAction: 'none',
    transform: isThisDragging ? 'scale(1.2)' : 'scale(1)',
    transition: isThisDragging ? 'none' : 'transform 0.12s ease, box-shadow 0.12s ease',
    zIndex: 10,
  };
}

interface YearRangeHandleProps {
  edgeType: EdgeType;
  year: number;
  isThisDragging: boolean;
  minAvailableYear: number;
  maxAvailableYear: number;
  startYear: number;
  endYear: number;
  onDragStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onEdgeKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

/** Drag handle for one end of the range; also supports Arrow key stepping (Sonar S6819 clickable-needs-keyboard). */
function YearRangeHandle({
  edgeType,
  year,
  isThisDragging,
  minAvailableYear,
  maxAvailableYear,
  startYear,
  endYear,
  onDragStart,
  onDragMove,
  onDragEnd,
  onEdgeKeyDown,
}: Readonly<YearRangeHandleProps>) {
  const edgeLabel = edgeType === 'start' ? 'Start' : 'End';
  const ariaMin = edgeType === 'start' ? minAvailableYear : startYear;
  const ariaMax = edgeType === 'start' ? endYear : maxAvailableYear;
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={`${edgeLabel} year: ${year}`}
      aria-valuemin={ariaMin}
      aria-valuemax={ariaMax}
      aria-valuenow={year}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={onEdgeKeyDown}
      style={getHandleStyle(isThisDragging)}
      title={`Drag to adjust ${edgeType} year (${year})`}
    />
  );
}

export function PanelRangePicker({ yearCounts }: Readonly<PanelRangePickerProps>) {
  const years = useMemo(() => {
    const list = Object.keys(yearCounts).map(Number).sort((a, b) => a - b);
    if (list.length === 0) {
      const cur = new Date().getFullYear();
      return [cur - 3, cur - 2, cur - 1, cur];
    }
    // Pad slightly to give room on the timeline if fewer than 4 years
    if (list.length < 4) {
      const min = list[0]!;
      const max = list.at(-1)!;
      const result: number[] = [];
      for (let y = min - 1; y <= max + 1; y++) {
        result.push(y);
      }
      return result;
    }
    return list;
  }, [yearCounts]);

  const minAvailableYear = years[0]!;
  const maxAvailableYear = years.at(-1)!;

  // Presentational interactive state (unbound per ADR-0024)
  const [isOpen, setIsOpen] = useState(false);
  const [startYear, setStartYear] = useState<number>(() => {
    // Default to last 3-4 years or available range
    if (years.length >= 4) return years.at(-4)!;
    return minAvailableYear;
  });
  const [endYear, setEndYear] = useState<number>(maxAvailableYear);

  const containerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // Scrollability indicators for edge shading
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = useCallback(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  const ITEM_WIDTH = 64; // px per year tick
  const totalYears = years.length;

  // Drag-scrolling state for the area above the horizontal line
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startScrollLeft: number;
    hasMoved: boolean;
  }>({ startX: 0, startScrollLeft: 0, hasMoved: false });

  // Explicit edge handle dragging state ('start' | 'end')
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const handleEdgeDragStart = (edge: 'start' | 'end', e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setDraggingHandle(edge);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleEdgeDragMove = (edge: 'start' | 'end', e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingHandle !== edge || !trackRef.current) return;
    e.stopPropagation();

    const trackRect = trackRef.current.getBoundingClientRect();
    const relativeX = e.clientX - trackRect.left;
    // Each tick center is at: idx * ITEM_WIDTH + ITEM_WIDTH / 2
    // So index is: (relativeX - ITEM_WIDTH / 2) / ITEM_WIDTH
    const rawIndex = Math.round((relativeX - ITEM_WIDTH / 2) / ITEM_WIDTH);
    const clampedIndex = Math.max(0, Math.min(years.length - 1, rawIndex));
    const targetYear = years[clampedIndex];
    if (targetYear == null) return;

    if (edge === 'start') {
      setStartYear(Math.min(targetYear, endYear));
    } else {
      setEndYear(Math.max(targetYear, startYear));
    }
  };

  const handleEdgeDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setDraggingHandle(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Arrow-key stepping for the drag handles, matching the ARIA slider pattern.
  const handleEdgeKeyDown = (edge: 'start' | 'end', e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentYear = edge === 'start' ? startYear : endYear;
    const idx = years.indexOf(currentYear);
    if (idx === -1) return;

    let direction = 0;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      direction = -1;
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      direction = 1;
    }
    if (direction === 0) return;

    e.preventDefault();
    const targetYear = years[idx + direction];
    if (targetYear == null) return;
    if (edge === 'start') {
      setStartYear(Math.min(targetYear, endYear));
    } else {
      setEndYear(Math.max(targetYear, startYear));
    }
  };

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || draggingHandle) return;
    if (!timelineScrollRef.current) return;

    dragRef.current = {
      startX: e.clientX,
      startScrollLeft: timelineScrollRef.current.scrollLeft,
      hasMoved: false,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !timelineScrollRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 3) {
      dragRef.current.hasMoved = true;
    }
    timelineScrollRef.current.scrollLeft = dragRef.current.startScrollLeft - dx;
    checkScrollability();
  };

  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (!dragRef.current.hasMoved) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const yearIndex = Math.floor(clickX / ITEM_WIDTH);
      if (yearIndex >= 0 && yearIndex < years.length && years[yearIndex] != null) {
        handleYearClick(years[yearIndex]!);
      }
    }
  };

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isOpen]);

  // Smooth mousewheel & scroll listener
  useEffect(() => {
    if (!isOpen) return;
    const el = timelineScrollRef.current;
    if (!el) return;

    checkScrollability();
    el.addEventListener('scroll', checkScrollability, { passive: true });
    window.addEventListener('resize', checkScrollability);

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollBy({ left: e.deltaY, behavior: 'smooth' });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('scroll', checkScrollability);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [isOpen, checkScrollability]);

  const handleYearClick = (year: number) => {
    // Move nearest handle; handles never cross
    const distStart = Math.abs(year - startYear);
    const distEnd = Math.abs(year - endYear);

    if (distStart < distEnd) {
      if (year <= endYear) {
        setStartYear(year);
      } else {
        setEndYear(year);
      }
    } else if (year >= startYear) {
      setEndYear(year);
    } else {
      setStartYear(year);
    }
  };

  const handleReset = () => {
    setStartYear(minAvailableYear);
    setEndYear(maxAvailableYear);
  };

  const isNarrowed = startYear > minAvailableYear || endYear < maxAvailableYear;

  // Compute positions for handles and active accent bar
  const startIndex = years.indexOf(startYear);
  const endIndex = years.indexOf(endYear);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Header Trigger */}
      <button
        type="button"
        className="mc-range-trigger"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Selected range: ${startYear} to ${endYear}. Open date range picker.`}
        {...pressable(() => setIsOpen(!isOpen))}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 14px',
          background: COLOR.surfaceCard,
          border: `1px solid ${isOpen ? COLOR.accent : COLOR.border}`,
          borderRadius: RADIUS.control,
          fontSize: 14,
          fontWeight: 600,
          color: COLOR.navy,
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <span>{startYear} — {endYear}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.18s ease',
            color: COLOR.navy,
          }}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown / Overlay Popup */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Panel date range"
          className="mc-range-popup"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 40,
            width: 440,
            maxWidth: 'calc(100vw - 32px)',
            background: COLOR.surfaceCard,
            borderRadius: RADIUS.card,
            border: `1px solid ${COLOR.borderSubtle}`,
            boxShadow: '0 10px 30px -4px rgba(6, 42, 79, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06)',
            padding: '20px 24px',
          }}
        >
          {/* Horizontally scrollable timeline with edge shading */}
          <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
            <div
              ref={timelineScrollRef}
              style={{
                overflowX: 'auto',
                scrollbarWidth: 'none',
                scrollBehavior: isDragging ? 'auto' : 'smooth',
                WebkitOverflowScrolling: 'touch',
                padding: '24px 12px 12px',
                position: 'relative',
              }}
            >
              <div
                ref={trackRef}
                style={{
                  position: 'relative',
                  width: totalYears * ITEM_WIDTH,
                  minWidth: '100%',
                  height: 60,
                }}
              >
                {/* Drag-scroll area above horizontal line */}
                <div
                  onPointerDown={handleDragStart}
                  onPointerMove={handleDragMove}
                  onPointerUp={handleDragEnd}
                  onPointerCancel={handleDragEnd}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 22,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    zIndex: 6,
                    touchAction: 'none',
                    userSelect: 'none',
                  }}
                  title="Drag horizontally to scroll timeline"
                />

                {/* Horizontal Base Track */}
                <div
                  style={{
                    position: 'absolute',
                    top: 24,
                    left: ITEM_WIDTH / 2,
                    right: ITEM_WIDTH / 2,
                    height: 2,
                    background: '#dbe3ea',
                    zIndex: 1,
                  }}
                />

                {/* Active Range Segment Bar */}
                {startIndex !== -1 && endIndex !== -1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 23,
                      left: startIndex * ITEM_WIDTH + ITEM_WIDTH / 2,
                      width: Math.max(0, (endIndex - startIndex) * ITEM_WIDTH),
                      height: 4,
                      background: '#1a88f8',
                      borderRadius: 2,
                      zIndex: 2,
                    }}
                  />
                )}

                {/* Range Background Glow / Wash */}
                {startIndex !== -1 && endIndex !== -1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 14,
                      left: startIndex * ITEM_WIDTH + ITEM_WIDTH / 2,
                      width: Math.max(0, (endIndex - startIndex) * ITEM_WIDTH),
                      height: 22,
                      background: 'rgba(26, 136, 248, 0.08)',
                      borderRadius: 4,
                      zIndex: 1,
                    }}
                  />
                )}

                {/* Year Ticks, Counts and Circular Handles */}
                {years.map((year, idx) => {
                  const count = yearCounts[year] ?? 0;
                  const isStart = year === startYear;
                  const isEnd = year === endYear;
                  const isSelected = isStart || isEnd;
                  const edgeType = resolveEdgeType(isStart, isEnd);
                  const isThisDragging = edgeType != null && draggingHandle === edgeType;

                  const xPos = idx * ITEM_WIDTH + ITEM_WIDTH / 2;
                  const countBadge = getCountBadge(count);
                  const yearLabelStyle = getYearLabelStyle(isSelected);

                  return (
                    <div
                      key={year}
                      {...pressable(() => handleYearClick(year))}
                      style={{
                        position: 'absolute',
                        left: xPos,
                        transform: 'translateX(-50%)',
                        top: 0,
                        bottom: 0,
                        width: ITEM_WIDTH,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        zIndex: isSelected ? 8 : 3,
                      }}
                      title={formatYearTickTitle(year, count)}
                    >
                      {/* Count above tick */}
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: countBadge.fontWeight,
                          color: countBadge.color,
                          lineHeight: 1,
                          height: 14,
                        }}
                      >
                        {countBadge.label}
                      </span>

                      {/* Tick or Circular Handle */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 25,
                          transform: 'translateY(-50%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isSelected && edgeType ? (
                          <YearRangeHandle
                            edgeType={edgeType}
                            year={year}
                            isThisDragging={isThisDragging}
                            minAvailableYear={minAvailableYear}
                            maxAvailableYear={maxAvailableYear}
                            startYear={startYear}
                            endYear={endYear}
                            onDragStart={(e) => handleEdgeDragStart(edgeType, e)}
                            onDragMove={(e) => handleEdgeDragMove(edgeType, e)}
                            onDragEnd={handleEdgeDragEnd}
                            onEdgeKeyDown={(e) => handleEdgeKeyDown(edgeType, e)}
                          />
                        ) : (
                          <div
                            style={{
                              width: 1,
                              height: 10,
                              background: '#b4c3d2',
                            }}
                          />
                        )}
                      </div>

                      {/* Year Label below line */}
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          fontSize: 12,
                          color: yearLabelStyle.color,
                          fontWeight: yearLabelStyle.fontWeight,
                        }}
                      >
                        {year}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Left Edge Gradient Shading */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: 36,
                background: 'linear-gradient(to right, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0))',
                pointerEvents: 'none',
                opacity: canScrollLeft ? 1 : 0,
                transition: 'opacity 0.2s ease',
                zIndex: 10,
              }}
            />

            {/* Right Edge Gradient Shading */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: 36,
                background: 'linear-gradient(to left, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0))',
                pointerEvents: 'none',
                opacity: canScrollRight ? 1 : 0,
                transition: 'opacity 0.2s ease',
                zIndex: 10,
              }}
            />
          </div>

          {/* Reset Action */}
          {isNarrowed && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14, paddingTop: 10, borderTop: `1px solid ${COLOR.borderSubtle}` }}>
              <button
                type="button"
                {...pressable(handleReset)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: 'none',
                  color: COLOR.link,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: RADIUS.control,
                }}
              >
                <RotateCcw size={13} aria-hidden="true" />
                Show all reports
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
