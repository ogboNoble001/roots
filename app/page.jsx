'use client';

import React, { useState } from 'react';

function StarburstIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <g stroke="#D97757" strokeWidth="2.55" strokeLinecap="round">
        <line x1="18" y1="3.5" x2="18" y2="32.5" />
        <line x1="3.5" y1="18" x2="32.5" y2="18" />
        <line x1="7.7" y1="7.7" x2="28.3" y2="28.3" />
        <line x1="28.3" y1="7.7" x2="7.7" y2="28.3" />
        <line x1="11.2" y1="4.8" x2="24.8" y2="31.2" />
        <line x1="24.8" y1="4.8" x2="11.2" y2="31.2" />
        <line x1="4.8" y1="11.2" x2="31.2" y2="24.8" />
        <line x1="31.2" y1="11.2" x2="4.8" y2="24.8" />
      </g>
    </svg>
  );
}

function SidebarToggleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="2.5"
        y="3.5"
        width="15"
        height="13"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <line
        x1="7.5"
        y1="3.5"
        x2="7.5"
        y2="16.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function GhostAvatarIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 17.5V10C5 6.68629 7.68629 4 11 4C14.3137 4 17 6.68629 17 10V17.5C17 17.8 16.5 18 16 17.5C15.3 16.8 14.5 16.8 13.8 17.5C13.1 18.2 12.2 18.2 11.5 17.5C10.8 16.8 10.1 16.8 9.4 17.5C8.7 18.2 7.8 18.2 7.1 17.5C6.4 16.8 5.7 16.8 5 17.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.2" cy="10.2" r="1" fill="currentColor" />
      <circle cx="12.8" cy="10.2" r="1" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9 3.5V14.5M3.5 9H14.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="6.5"
        y="2.5"
        width="5"
        height="8.5"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M4 9.5C4 12.2614 6.23858 14.5 9 14.5C11.7614 14.5 14 12.2614 14 9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line
        x1="9"
        y1="14.5"
        x2="9"
        y2="16.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WaveformIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <line x1="3.5" y1="7" x2="3.5" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6.2" y1="4.5" x2="6.2" y2="13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="3" x2="9" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11.8" y1="5.5" x2="11.8" y2="12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14.5" y1="7.5" x2="14.5" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function HomePage() {
  const [mode, setMode] = useState('Chat');
  const [prompt, setPrompt] = useState('');

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--bg-cream)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          width: '100%',
        }}
      >
        <button
          type="button"
          aria-label="Toggle sidebar"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SidebarToggleIcon />
        </button>

        <button
          type="button"
          aria-label="User profile"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <GhostAvatarIcon />
        </button>
      </header>

      {/* Top Center Pill */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '6px',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(31, 30, 27, 0.05)',
            borderRadius: '9999px',
            padding: '6px 15px',
            fontSize: '12.5px',
            color: 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            letterSpacing: '-0.005em',
          }}
        >
          <span>Free plan</span>
          <span style={{ opacity: 0.45 }}>·</span>
          <a
            href="#upgrade"
            onClick={(e) => e.preventDefault()}
            style={{
              color: 'var(--accent-link)',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              fontWeight: 400,
            }}
          >
            Upgrade
          </a>
        </div>
      </div>

      {/* Main Centered Section */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 20px 10vh 20px',
        }}
      >
        {/* Greeting Header in The Silver Editorial */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '13px',
            marginBottom: '30px',
          }}
        >
          <StarburstIcon />
          <h1
            className="serif-header"
            style={{
              fontSize: '44px',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              fontWeight: 400,
            }}
          >
            Back at it, Noble
          </h1>
        </div>

        {/* Composer Card */}
        <div
          style={{
            width: '100%',
            maxWidth: '640px',
            backgroundColor: 'var(--surface-box)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '18px',
            padding: '16px 16px 12px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '112px',
            boxShadow: '0 2px 12px rgba(31, 29, 25, 0.03)',
          }}
        >
          {/* Textarea Input */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="How can I help you today?"
            rows={2}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: ' inherit',
              fontSize: '15px',
              lineHeight: 1.5,
              color: 'var(--text-primary)',
            }}
          />

          {/* Bottom Controls Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '10px',
            }}
          >
            {/* Left Controls: + and Chat/Cowork toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                aria-label="Add attachment"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  borderRadius: '6px',
                }}
              >
                <PlusIcon />
              </button>

              {/* Segmented Toggle */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--pill-bg)',
                  borderRadius: '8px',
                  padding: '2px',
                  gap: '2px',
                }}
              >
                {['Chat', 'Cowork'].map((item) => {
                  const active = mode === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setMode(item)}
                      style={{
                        background: active ? 'var(--pill-active)' : 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '12.5px',
                        fontFamily: 'inherit',
                        fontWeight: active ? 500 : 400,
                        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Controls: Model label, Mic dropdown, Waveform */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  Sonnet 5.5
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>Medium</span>
              </div>

              <button
                type="button"
                aria-label="Voice input"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '4px',
                }}
              >
                <MicIcon />
                <ChevronDownIcon />
              </button>

              <button
                type="button"
                aria-label="Voice mode"
                style={{
                  backgroundColor: 'rgba(31, 30, 27, 0.06)',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <WaveformIcon />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
