import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, CandlestickSeriesPartialOptions } from 'lightweight-charts';

const Chart: React.FC<{ candles: any[] }> = ({ candles }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi & { addCandlestickSeries?: any; _series?: any; _hasFitted?: boolean } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!chartRef.current) {
      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 420,
        layout: { background: { color: '#0b1220' }, textColor: '#94A3B8' },
      }) as IChartApi & { addCandlestickSeries: (options?: CandlestickSeriesPartialOptions) => any };

      const series = chart.addCandlestickSeries({
        upColor: '#10B981',
        downColor: '#FB7185',
        borderDownColor: '#FB7185',
        borderUpColor: '#10B981',
        wickDownColor: '#FB7185',
        wickUpColor: '#10B981',
      });

      (chart as any)._series = series;
      (chart as any)._hasFitted = false;
      chartRef.current = chart;

      const onResize = () => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      };
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    const s = (chartRef.current as any)._series;
    s.setData(
      candles.map((c: any) => ({
        time: c.time / 1000,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    if (!(chartRef.current as any)._hasFitted) {
      chartRef.current.timeScale().fitContent();
      (chartRef.current as any)._hasFitted = true;
    }
  }, [candles]);

  return (
    <div className="card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button className="btn" onClick={() => chartRef.current?.timeScale().fitContent()}>
          Ajustar
        </button>
        <button className="btn" onClick={() => chartRef.current?.timeScale().scrollToRealTime()}>
          Ir a Real-time
        </button>
      </div>
      <div
        ref={containerRef}
        onDoubleClick={() => {
          if (chartRef.current) {
            (chartRef.current as any)._hasFitted = false;
            chartRef.current.timeScale().fitContent();
          }
        }}
      />
    </div>
  );
};

export default Chart;
