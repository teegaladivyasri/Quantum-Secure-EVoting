import React from 'react';
import { Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';

interface TelemetryProps {
  qber: number;
  qberPercentage?: number;
  channelStatus?: string;
  eavesdroppingSimulated?: boolean;
}

export const QuantumTelemetryBadge: React.FC<TelemetryProps> = ({
  qber,
  qberPercentage,
  channelStatus = "SECURE_ACCEPTABLE",
  eavesdroppingSimulated = false
}) => {
  const percentage = qberPercentage !== undefined ? qberPercentage : (qber * 100);
  const isSafe = qber <= 0.11;

  return (
    <div style={{
      background: 'var(--bg-surface-elevated)',
      border: `1px solid ${isSafe ? 'var(--color-soft-gold)' : 'var(--color-danger)'}`,
      borderRadius: 'var(--radius-md)',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      boxShadow: isSafe ? 'var(--gold-glow)' : 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Cpu size={20} color="var(--color-soft-gold)" />
          <span>BB84 QKD Protocol Telemetry (Qiskit)</span>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: '0.8rem',
          fontWeight: 700,
          padding: '0.25rem 0.65rem',
          borderRadius: '9999px',
          background: isSafe ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
          color: isSafe ? 'var(--color-success)' : 'var(--color-danger)',
          border: `1px solid ${isSafe ? 'var(--color-success)' : 'var(--color-danger)'}`
        }}>
          {isSafe ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          <span>{isSafe ? channelStatus : 'DISTURBANCE DETECTED'}</span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.75rem',
        marginTop: '0.25rem'
      }}>
        <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Calculated QBER</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: isSafe ? 'var(--text-gold)' : 'var(--color-danger)' }}>
            {percentage.toFixed(2)}%
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Safety Threshold</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            &le; 11.00%
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Payload Cipher</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            AES-256-GCM
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Simulation Channel Mode</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: eavesdroppingSimulated ? 'var(--color-warning)' : 'var(--color-success)' }}>
            {eavesdroppingSimulated ? 'Simulated Eve / Disturbance' : 'Ideal Channel'}
          </div>
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.3', marginTop: '0.25rem' }}>
        <em>Note: QBER above the configured threshold causes the BB84 key-establishment attempt to be rejected because the observed disturbance is too high. The disturbance may be caused by simulated eavesdropping, channel noise, or other errors.</em>
      </div>
    </div>
  );
};
