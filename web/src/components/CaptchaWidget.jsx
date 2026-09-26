import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Loader2, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';

const SCRIPT_URLS = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
  recaptcha_v2: 'https://www.google.com/recaptcha/api.js?render=explicit',
  recaptcha_v3: (key) => `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`,
  hcaptcha: 'https://js.hcaptcha.com/1/api.js?render=explicit',
};

const scriptPromises = {};

function loadProviderScript(provider, siteKey) {
  const url = provider === 'recaptcha_v3' ? SCRIPT_URLS.recaptcha_v3(siteKey) : SCRIPT_URLS[provider];
  if (!url) return Promise.reject(new Error(`Unknown captcha provider: ${provider}`));

  const scriptId = `script-captcha-${provider}`;
  if (scriptPromises[scriptId]) {
    return scriptPromises[scriptId];
  }

  if (document.getElementById(scriptId)) {
    return Promise.resolve();
  }

  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.id = scriptId;
    s.src = url;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = (e) => {
      delete scriptPromises[scriptId];
      reject(new Error(`Failed to load ${provider} script`));
    };
    document.head.appendChild(s);
  });

  scriptPromises[scriptId] = p;
  return p;
}

const CaptchaWidget = forwardRef(function CaptchaWidget(
  {
    provider,
    siteKey,
    onVerify,
    onExpire,
    onError,
    theme = 'auto',
    size = 'normal',
    className = '',
  },
  ref
) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onVerifyRef.current = onVerify;
  }, [onVerify]);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Execute method for reCAPTCHA v3
  const executeV3 = async (action = 'submit') => {
    if (provider !== 'recaptcha_v3') return null;
    if (!siteKey) {
      setLoadError('Missing Site Key for reCAPTCHA v3');
      return null;
    }
    setV3Executing(true);
    setLoadError('');
    try {
      await loadProviderScript('recaptcha_v3', siteKey);
      if (!window.grecaptcha) {
        throw new Error('reCAPTCHA v3 library failed to initialize');
      }
      return await new Promise((resolve, reject) => {
        window.grecaptcha.ready(async () => {
          try {
            const token = await window.grecaptcha.execute(siteKey, { action });
            onVerifyRef.current?.(token);
            resolve(token);
          } catch (err) {
            onErrorRef.current?.(err);
            reject(err);
          }
        });
      });
    } catch (err) {
      setLoadError(err.message || 'Failed to execute reCAPTCHA v3');
      onErrorRef.current?.(err);
      return null;
    } finally {
      setV3Executing(false);
    }
  };

  // Reset method
  const reset = () => {
    try {
      if (provider === 'turnstile' && window.turnstile && widgetIdRef.current != null) {
        window.turnstile.reset(widgetIdRef.current);
      } else if (provider === 'recaptcha_v2' && window.grecaptcha && widgetIdRef.current != null) {
        window.grecaptcha.reset(widgetIdRef.current);
      } else if (provider === 'hcaptcha' && window.hcaptcha && widgetIdRef.current != null) {
        window.hcaptcha.reset(widgetIdRef.current);
      }
    } catch { }
  };

  useImperativeHandle(ref, () => ({
    reset,
    execute: executeV3,
  }));

  useEffect(() => {
    if (!provider || provider === 'default' || provider === 'disabled') {
      return;
    }

    if (!siteKey || !siteKey.trim()) {
      setLoadError('Please provide a valid Site Key to initialize the challenge.');
      setLoading(false);
      return;
    }

    setLoadError('');
    setLoading(true);

    let isMounted = true;

    loadProviderScript(provider, siteKey.trim())
      .then(() => {
        if (!isMounted) return;
        setLoading(false);

        // reCAPTCHA v3 does not render DOM widgets
        if (provider === 'recaptcha_v3') {
          return;
        }

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';

        if (provider === 'turnstile') {
          if (!window.turnstile) {
            throw new Error('Cloudflare Turnstile failed to load');
          }
          const id = window.turnstile.render(container, {
            sitekey: siteKey.trim(),
            theme,
            size,
            callback: (token) => {
              if (isMounted) onVerifyRef.current?.(token);
            },
            'expired-callback': () => {
              if (isMounted) onExpireRef.current?.();
            },
            'error-callback': (code) => {
              if (isMounted) {
                const msg = typeof code === 'string' ? code : 'Turnstile challenge failed';
                setLoadError(msg);
                onErrorRef.current?.(msg);
              }
            },
          });
          widgetIdRef.current = id;
        } else if (provider === 'recaptcha_v2') {
          if (!window.grecaptcha) {
            throw new Error('Google reCAPTCHA failed to load');
          }
          window.grecaptcha.ready(() => {
            if (!isMounted || !containerRef.current) return;
            try {
              const id = window.grecaptcha.render(containerRef.current, {
                sitekey: siteKey.trim(),
                theme: theme === 'dark' ? 'dark' : 'light',
                size,
                callback: (token) => {
                  if (isMounted) onVerifyRef.current?.(token);
                },
                'expired-callback': () => {
                  if (isMounted) onExpireRef.current?.();
                },
                'error-callback': () => {
                  if (isMounted) {
                    setLoadError('reCAPTCHA verification error');
                    onErrorRef.current?.('reCAPTCHA error');
                  }
                },
              });
              widgetIdRef.current = id;
            } catch (err) {
              if (isMounted) setLoadError(err.message || 'Failed rendering reCAPTCHA');
            }
          });
        } else if (provider === 'hcaptcha') {
          if (!window.hcaptcha) {
            throw new Error('hCaptcha failed to load');
          }
          const id = window.hcaptcha.render(container, {
            sitekey: siteKey.trim(),
            theme: theme === 'dark' ? 'dark' : 'light',
            size,
            callback: (token) => {
              if (isMounted) onVerifyRef.current?.(token);
            },
            'expired-callback': () => {
              if (isMounted) onExpireRef.current?.();
            },
            'error-callback': (err) => {
              if (isMounted) {
                setLoadError('hCaptcha error');
                onErrorRef.current?.(err);
              }
            },
          });
          widgetIdRef.current = id;
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoading(false);
        setLoadError(err.message || `Failed to load ${provider} library`);
        onErrorRef.current?.(err);
      });

    return () => {
      isMounted = false;
      try {
        if (provider === 'turnstile' && window.turnstile && widgetIdRef.current != null) {
          window.turnstile.remove(widgetIdRef.current);
        } else if (provider === 'hcaptcha' && window.hcaptcha && widgetIdRef.current != null) {
          window.hcaptcha.remove(widgetIdRef.current);
        }
      } catch { }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      widgetIdRef.current = null;
    };
  }, [provider, siteKey]);

  if (!provider || provider === 'default' || provider === 'disabled') {
    return null;
  }

  return (
    <div className={`captcha-widget-wrapper ${className}`}>
      {loading && (
        <div className="flex items-center gap-2 py-3 text-xs text-[#8898aa] dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-[#3970e1]" />
          <span>Loading {provider} challenge...</span>
        </div>
      )}

      {loadError && (
        <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-[0.375rem] text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold block">Challenge Error</span>
            <span className="break-words">{loadError}</span>
          </div>
        </div>
      )}

      {provider === 'recaptcha_v3' ? (
        <div className="p-3 bg-blue-50/70 dark:bg-slate-800/60 border border-blue-200 dark:border-slate-700 rounded-[0.375rem] space-y-2">
          <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 font-medium">
            <ShieldCheck className="w-4 h-4 text-[#3970e1]" />
            <span>Google reCAPTCHA v3 executes invisibly without user prompts.</span>
          </div>
          <p className="text-[12px] text-[#8898aa] dark:text-slate-400">
            Protected actions calculate a bot risk score in the background automatically.
          </p>
          <button
            type="button"
            onClick={() => executeV3('test')}
            disabled={v3Executing || !siteKey}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3970e1] hover:bg-[#2b5cc4] text-white rounded text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50"
          >
            {v3Executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>{v3Executing ? 'Testing reCAPTCHA v3...' : 'Trigger v3 Verification Test'}</span>
          </button>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="min-h-[65px] flex items-center justify-center my-1"
        />
      )}
    </div>
  );
});

export default CaptchaWidget;
