import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Save,
  ExternalLink,
} from 'lucide-react';
import CaptchaWidget from '../../../components/CaptchaWidget';
import { settingsApi } from '../../../api/client';

export default function CaptchaSettingsSection({
  form,
  setForm,
  cleanForm,
  captchaVerified,
  setCaptchaVerified,
  handleSaveSettings,
  saving = false,
}) {
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }
  const [lastTestedKey, setLastTestedKey] = useState('');
  const widgetRef = useRef(null);
  const formRef = useRef(form);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const isExternal =
    form.captcha_provider !== 'default' && form.captcha_provider !== 'disabled';

  // Key tracking to ensure changes invalidate previous test
  const currentKeyFingerprint = `${form.captcha_provider}:${form.captcha_site_key?.trim()}:${form.captcha_secret_key?.trim()}`;

  // Automatically check if current keys match previously saved clean keys
  useEffect(() => {
    if (!isExternal) {
      setCaptchaVerified(true);
      setTestResult(null);
      return;
    }

    const isCleanSaved =
      cleanForm &&
      cleanForm.captcha_provider === form.captcha_provider &&
      cleanForm.captcha_site_key?.trim() === form.captcha_site_key?.trim() &&
      cleanForm.captcha_secret_key?.trim() === form.captcha_secret_key?.trim() &&
      Boolean(form.captcha_site_key?.trim());

    if (isCleanSaved) {
      setCaptchaVerified(true);
      if (!testResult) {
        setTestResult({
          success: true,
          message: 'Active configured provider from saved settings.',
        });
      }
    } else if (lastTestedKey !== currentKeyFingerprint) {
      setCaptchaVerified(false);
      setTestResult(null);
    }
  }, [
    form.captcha_provider,
    form.captcha_site_key,
    form.captcha_secret_key,
    cleanForm,
    isExternal,
    lastTestedKey,
    currentKeyFingerprint,
    setCaptchaVerified,
  ]);

  // Handle Token Received from Captcha Challenge
  const handleChallengeSolved = async (token) => {
    if (!token) return;

    const currentForm = formRef.current || form;
    const provider = currentForm.captcha_provider;
    const siteKey = currentForm.captcha_site_key?.trim();
    const secretKey = currentForm.captcha_secret_key?.trim();

    if (!siteKey || !secretKey) {
      setCaptchaVerified(false);
      setTestResult({
        success: false,
        message: 'Both Public Site Key and Private Secret Key are required to run the verification test.',
      });
      return;
    }

    if (testing) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await settingsApi.testCaptcha({
        provider,
        site_key: siteKey,
        secret_key: secretKey,
        solution: token,
      });

      if (res.valid) {
        setCaptchaVerified(true);
        setLastTestedKey(`${provider}:${siteKey}:${secretKey}`);
        setTestResult({
          success: true,
          message: res.message || 'Verification successful! Settings are safe to save.',
        });
      } else {
        setCaptchaVerified(false);
        setTestResult({
          success: false,
          message: res.message || 'Verification failed with the selected provider.',
        });
      }
    } catch (err) {
      setCaptchaVerified(false);
      setTestResult({
        success: false,
        message: err.message || 'Network error during verification test.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleResetTest = () => {
    setCaptchaVerified(false);
    setTestResult(null);
    widgetRef.current?.reset();
  };

  const getProviderDocLink = () => {
    switch (form.captcha_provider) {
      case 'turnstile':
        return 'https://dash.cloudflare.com/?to=/:account/turnstile';
      case 'recaptcha_v2':
      case 'recaptcha_v3':
        return 'https://www.google.com/recaptcha/admin';
      case 'hcaptcha':
        return 'https://dashboard.hcaptcha.com';
      default:
        return null;
    }
  };

  const docLink = getProviderDocLink();

  return (
    <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-5 shadow-argon dark:shadow-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e9ecef] dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[0.375rem] bg-[#5e72e4]/10 dark:bg-indigo-950/60 border border-[#5e72e4]/20 dark:border-indigo-700/40 flex items-center justify-center text-[#5e72e4] dark:text-indigo-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#32325d] dark:text-white">
              Captcha & Anti-Bot Protection
            </h2>
            <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
              Interactive bot mitigation challenge for administrator dashboard login
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <span
          className={`px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider font-mono border ${
            form.captcha_provider === 'disabled'
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
              : 'bg-blue-50 dark:bg-blue-950/40 text-[#3970e1] dark:text-blue-400 border-blue-200 dark:border-blue-800'
          }`}
        >
          {form.captcha_provider === 'default'
            ? 'Built-in SVG'
            : form.captcha_provider === 'disabled'
            ? 'Disabled'
            : form.captcha_provider === 'turnstile'
            ? 'Cloudflare Turnstile'
            : form.captcha_provider === 'recaptcha_v2'
            ? 'Google reCAPTCHA v2'
            : form.captcha_provider === 'recaptcha_v3'
            ? 'Google reCAPTCHA v3'
            : form.captcha_provider === 'hcaptcha'
            ? 'hCaptcha'
            : form.captcha_provider}
        </span>
      </div>

      {/* Provider Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[#32325d] dark:text-white flex items-center gap-2">
          <span>Captcha Provider</span>
        </label>
        <select
          value={form.captcha_provider || 'default'}
          onChange={(e) => {
            const val = e.target.value;
            setForm((prev) => ({
              ...prev,
              captcha_provider: val,
            }));
            setTestResult(null);
          }}
          className="w-full sm:w-96 px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
        >
          <option value="default">Default Built-in SVG (Zero configuration required)</option>
          <option value="turnstile">Cloudflare Turnstile</option>
          <option value="recaptcha_v2">Google reCAPTCHA v2 (Checkbox)</option>
          <option value="recaptcha_v3">Google reCAPTCHA v3 (Invisible)</option>
          <option value="hcaptcha">hCaptcha</option>
          <option value="disabled">Disabled (Not Recommended)</option>
        </select>
        <p className="text-[12px] text-[#8898aa] dark:text-slate-400">
          Choose between zero-setup offline SVG challenge or enterprise third-party services.
        </p>
      </div>

      {/* Default Built-in Notice */}
      {form.captcha_provider === 'default' && (
        <div className="p-3.5 bg-blue-50/60 dark:bg-slate-800/60 border border-blue-200 dark:border-slate-700 rounded-[0.375rem] space-y-1 text-xs text-[#525f7f] dark:text-slate-300">
          <div className="flex items-center gap-2 font-semibold text-[#3970e1] dark:text-blue-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Built-in SVG Challenge Active</span>
          </div>
          <p className="text-[12px] text-[#8898aa] dark:text-slate-400 leading-relaxed">
            Generates distortion-based alphanumeric SVG challenges directly on the server without sending requests to third parties. Requires no API keys, accounts, or external network connectivity.
          </p>
        </div>
      )}

      {/* Disabled Warning */}
      {form.captcha_provider === 'disabled' && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-[0.375rem] space-y-1 text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2 font-semibold text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Anti-Bot Verification Disabled</span>
          </div>
          <p className="text-[12px] leading-relaxed">
            Disabling captcha removes challenge verification on login, leaving the management interface susceptible to automated password spraying and credential stuffing bots. Use with extreme caution.
          </p>
        </div>
      )}

      {/* External Keys Configuration */}
      {isExternal && (
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Site Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
                <span>Public Site Key</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 0x4AAAAAA..."
                value={form.captcha_site_key || ''}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    captcha_site_key: e.target.value.trim(),
                  }))
                }
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
              />
              <span className="text-[11px] text-[#8898aa] dark:text-slate-400">
                Provided by your captcha provider dashboard.
              </span>
            </div>

            {/* Secret Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
                <span>Private Secret Key</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="relative">
                <input
                  type={showSecretKey ? 'text' : 'password'}
                  placeholder="Private Secret Key"
                  value={form.captcha_secret_key || ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      captcha_secret_key: e.target.value.trim(),
                    }))
                  }
                  className="w-full px-3 py-1.5 pr-9 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8898aa] hover:text-[#32325d] dark:hover:text-white transition"
                  title={showSecretKey ? 'Hide Secret Key' : 'Show Secret Key'}
                >
                  {showSecretKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[11px] text-[#8898aa] dark:text-slate-400">
                Used exclusively by the backend to verify client responses.
              </span>
            </div>
          </div>

          {docLink && (
            <div className="flex items-center gap-1.5 text-xs text-[#3970e1] dark:text-blue-400">
              <ExternalLink className="w-3 h-3 shrink-0" />
              <a
                href={docLink}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline font-medium"
              >
                Open {form.captcha_provider.replace('_', ' ').toUpperCase()} Dashboard to obtain API keys
              </a>
            </div>
          )}

          {/* Verification Test Card (Anti-Lockout Protection) */}
          <div className="p-4 rounded-[0.375rem] border border-blue-200/80 dark:border-blue-900/40 bg-[#f8f9fe] dark:bg-slate-800/50 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#3970e1] dark:text-blue-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-[#32325d] dark:text-white">
                    Live Lockout Protection Test
                  </h4>
                  <p className="text-[12px] text-[#8898aa] dark:text-slate-400">
                    Solve the challenge below to test your credentials before saving
                  </p>
                </div>
              </div>

              {testResult && (
                <button
                  type="button"
                  onClick={handleResetTest}
                  className="text-xs text-[#3970e1] dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retest</span>
                </button>
              )}
            </div>

            {/* Test Result Message */}
            {testResult && (
              <div
                className={`p-2.5 rounded-[0.25rem] text-xs flex items-center justify-between gap-2 border ${
                  testResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  )}
                  <span className="flex-1 min-w-0 font-medium break-words">{testResult.message}</span>
                </div>
                {!testResult.success && (
                  <button
                    type="button"
                    onClick={handleResetTest}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shrink-0 transition"
                  >
                    Retry Test
                  </button>
                )}
              </div>
            )}

            {/* Widget container */}
            <div className="pt-1">
              {!form.captcha_site_key?.trim() || !form.captcha_secret_key?.trim() ? (
                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-[0.375rem] text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="font-semibold block">Configuration Required</span>
                    <span className="text-[12px]">
                      Enter both your <strong>Public Site Key</strong> and <strong>Private Secret Key</strong> above to initialize the verification challenge.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem]">
                  <CaptchaWidget
                    key={`${form.captcha_provider}:${form.captcha_site_key?.trim()}`}
                    ref={widgetRef}
                    provider={form.captcha_provider}
                    siteKey={form.captcha_site_key?.trim()}
                    onVerify={handleChallengeSolved}
                    onError={(err) => {
                      setCaptchaVerified(false);
                      setTestResult({
                        success: false,
                        message: typeof err === 'string' ? err : 'Challenge execution failed.',
                      });
                    }}
                  />

                  {testing && (
                    <div className="flex items-center gap-2 py-2 text-xs text-[#3970e1]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying token with {form.captcha_provider}...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer & Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-[#e9ecef] dark:border-slate-800 text-[13px] text-[#8898aa] dark:text-slate-400">
        <div>
          {isExternal && !captchaVerified ? (
            <span className="text-[#f5365c] dark:text-rose-400 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>You must pass the verification test above before saving this provider.</span>
            </span>
          ) : (
            <span>Captcha settings take effect immediately for all subsequent login attempts.</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={saving || (isExternal && !captchaVerified)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#3970e1] hover:bg-[#2b5cc4] text-white rounded-[0.25rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50 shrink-0 cursor-pointer disabled:cursor-not-allowed"
          title={
            isExternal && !captchaVerified
              ? 'Complete the test challenge above to enable saving'
              : 'Save Captcha Settings'
          }
        >
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Save className="w-3 h-3" />
          )}
          <span>
            {saving
              ? 'Saving...'
              : isExternal && !captchaVerified
              ? 'Test Required to Save'
              : 'Save Captcha Settings'}
          </span>
        </button>
      </div>
    </div>
  );
}
