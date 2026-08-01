"use client";

import React, { useState } from 'react';

export default function IntakeChannelsPage() {
  const [channels, setChannels] = useState([
    { id: 'c1', name: 'NHRC Website Webhook', code: 'WEB_HOOK', status: 'active', url: 'https://api.humanrights.local/webhook/intake' },
    { id: 'c2', name: 'Official Email (complaints@nhrc.th)', code: 'EMAIL', status: 'active', url: '-' },
    { id: 'c3', name: 'Legacy System Integration', code: 'LEGACY_API', status: 'inactive', url: '-' }
  ]);

  return (
    <div className="case-app">
      <div className="case-container">
        <div className="case-dashboard-hero">
          <div>
            <span className="case-eyebrow">Administration</span>
            <h1>Intake Channels</h1>
            <p>Manage integrations and webhooks for omnichannel complaint intake.</p>
          </div>
          <div className="case-hero-actions">
            <button className="case-primary-button">+ Add Channel</button>
          </div>
        </div>

        <div className="case-workspace">
          <div className="workspace-stack">
            {channels.map(channel => (
              <article key={channel.id} className="workspace-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>{channel.name}</h2>
                  <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '0 0 12px' }}>Code: {channel.code}</p>
                  {channel.url !== '-' && (
                    <div style={{ background: 'var(--paper)', padding: '8px 12px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px', border: '1px solid var(--line)' }}>
                      Endpoint: {channel.url}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '20px', 
                    fontSize: '12px', 
                    fontWeight: 700,
                    background: channel.status === 'active' ? '#d1fae5' : '#f1f5f9',
                    color: channel.status === 'active' ? '#047857' : '#475569',
                    textTransform: 'uppercase'
                  }}>
                    {channel.status}
                  </span>
                  <button className="case-secondary-button" style={{ padding: '6px 12px', fontSize: '13px' }}>Configure</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
