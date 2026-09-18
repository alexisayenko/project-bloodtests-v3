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
      const max = list[list.length - 1]!;
      const result: number[] = [];
      for (let y = min - 1; y <= max + 1; y++) {
        result.push(y);
      }
      return result;
    }
    return list;
  }, [yearCounts]);

  const minAvailableYear = years[0]!;
  const maxAvailableYear = years[years.length - 1]!;

  // Presentational interactive state (unbound per ADR-0024)
  const [isOpen, setIsOpen] = useState(false);
  const [startYear, setStartYear] = useState<number>(() => {
    // Default to last 3-4 years or available range
    if (years.length >= 4) return years[years.length - 4]!;
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
    } else {
      if (year >= startYear) {
        setEndYear(year);
      } else {
        setStartYear(year);
      }
    }
  };

  const handleReset = () => {
    setStartYear(minAvailableYear);
    setEndYear(maxAvailableYear);
  };

  const isNarrowed = startYear > minAvailableYear || endYear < maxAvailableYear;

  // Compute percentage positions for handles and active accent bar
  const startIndex = years.indexOf(startYear);
  const endIndex = years.indexOf(endYear);
  const totalYears = years.length;

  const ITEM_WIDTH = 64; // px per year tick

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
          {/* Active Range Pill */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <span
              style={{
                display: 'inline-block',
                background: '#eef5fc',
                color: COLOR.navy,
                fontSize: 14,
                fontWeight: 600,
                padding: '5px 22px',
                borderRadius: 9999,
              }}
            >
              {startYear} — {endYear}
            </span>
          </div>

          {/* Horizontally scrollable timeline with edge shading */}
          <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
            <div
              ref={timelineScrollRef}
              style={{
                overflowX: 'auto',
                scrollbarWidth: 'none',
                scrollBehavior: 'smooth',
                WebkitOverflowScrolling: 'touch',
                padding: '24px 12px 12px',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: totalYears * ITEM_WIDTH,
                  minWidth: '100%',
                  height: 60,
                }}
              >
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

                  const xPos = idx * ITEM_WIDTH + ITEM_WIDTH / 2;

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
                        zIndex: 3,
                      }}
                      title={`${year}: ${count} report${count === 1 ? '' : 's'}`}
                    >
                      {/* Count above tick */}
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: count > 0 ? 600 : 400,
                          color: count > 0 ? COLOR.navy : 'transparent',
                          lineHeight: 1,
                          height: 14,
                        }}
                      >
                        {count > 0 ? count : ''}
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
                        {isSelected ? (
                          <div
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              background: '#1a88f8',
                              border: '2.5px solid #ffffff',
                              boxShadow: '0 1px 4px rgba(26, 136, 248, 0.4)',
                              cursor: 'grab',
                            }}
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
                          color: isSelected ? COLOR.navy : COLOR.textMuted,
                          fontWeight: isSelected ? 600 : 400,
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
