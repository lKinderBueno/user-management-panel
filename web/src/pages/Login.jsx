import React from 'react';
import { Tv, Shield, Lock, User, RefreshCw, AlertCircle, Loader2, Sun, Moon } from 'lucide-react';
import { authApi, setToken, setAdmin } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import CaptchaWidget from '../components/CaptchaWidget';

export default function Login({ onLoginSuccess }) {
  const { isDark, toggleDark } = useTheme();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [captchaProvider, setCaptchaProvider] = React.useState('default');
  const [captchaSiteKey, setCaptchaSiteKey] = React.useState('');
  const [captchaId, setCaptchaId] = React.useState('');
  const [captchaSvg, setCaptchaSvg] = React.useState('');
  const [captchaAnswer, setCaptchaAnswer] = React.useState('');

  const widgetRef = React.useRef(null);
  const [loading, setLoading] = React.useState(false);
  const [refreshingCaptcha, setRefreshingCaptcha] = React.useState(false);
  const [error, setError] = React.useState('');

  const loadCaptcha = React.useCallback(async () => {
    setRefreshingCaptcha(true);
    try {
      const res = await authApi.getCaptcha();
      const prov = res?.provider || 'default';
      setCaptchaProvider(prov);
      setCaptchaSiteKey(res?.site_key || '');
      setCaptchaId(res?.id || '');
      setCaptchaSvg(res?.svg || '');
      setCaptchaAnswer('');
      widgetRef.current?.reset();
    } catch {
      setError('Unable to load captcha challenge');
    } finally {
      setRefreshingCaptcha(false);
    }
  }, []);

  React.useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  const isExternalVisible =
    captchaProvider === 'turnstile' ||
    captchaProvider === 'recaptcha_v2' ||
    captchaProvider === 'hcaptcha';

  const isSubmitDisabled = () => {
    if (loading) return true;
    if (captchaProvider === 'disabled') return false;
    if (captchaProvider === 'recaptcha_v3') return !captchaSiteKey;
    if (isExternalVisible) return !captchaAnswer || !captchaSiteKey;
    // Default SVG
    return !captchaAnswer;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let answer = captchaAnswer.trim();

    // reCAPTCHA v3 executes invisibly on form submit
    if (captchaProvider === 'recaptcha_v3') {
      try {
        const token = await widgetRef.current?.execute('admin_login');
        if (!token) {
          setError('reCAPTCHA v3 verification failed. Please try again.');
          setLoading(false);
          return;
        }
        answer = token;
      } catch (err) {
        setError(err?.message || 'Failed executing reCAPTCHA v3');
        setLoading(false);
        return;
      }
    }

    try {
      const res = await authApi.login({
        username: username.trim(),
        password: password.trim(),
        captcha_id: captchaId,
        captcha_answer: answer,
      });

      setToken(res.token);
      setAdmin(res.admin);
      onLoginSuccess(res.admin);
    } catch (err) {
      setError(err.message || 'Invalid credentials or captcha');
      loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fe] dark:bg-[#0f172a] flex flex-col justify-center items-center p-4 relative transition-colors duration-200">
      {/* Theme Toggle Button */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggleDark}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>
      </div>

      <div className="w-full max-w-sm">
        {/* PlaylistLabs brand header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-[0.375rem] bg-[#3970e1] shadow-argon-btn flex items-center justify-center text-white mx-auto mb-3">
            <Tv className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-[#32325d] dark:text-white tracking-tight">
            Sign in
          </h1>
          <p className="text-xs text-[#8898aa] dark:text-slate-400 mt-0.5">
            User management panel
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700/80 rounded-[0.375rem] p-6 sm:p-7 shadow-argon dark:shadow-2xl transition-colors duration-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-2.5 bg-[#fdf2f2] dark:bg-rose-950/40 border border-[#f5365c]/30 dark:border-rose-800/50 rounded-[0.375rem] text-xs text-[#f5365c] dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#f5365c] dark:text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Username */}
            <div>
              <label className="text-xs font-semibold text-[#32325d] dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#8898aa] dark:text-slate-400" />
                <span>Username</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs text-[#495057] dark:text-slate-100 placeholder-[#8898aa] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 focus:ring-1 focus:ring-[#3970e1]/30 shadow-argon-sm transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-[#32325d] dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#8898aa] dark:text-slate-400" />
                <span>Password</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs text-[#495057] dark:text-slate-100 placeholder-[#8898aa] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 focus:ring-1 focus:ring-[#3970e1]/30 shadow-argon-sm transition"
              />
            </div>

            {/* 1. Default Built-in SVG Captcha */}
            {captchaProvider === 'default' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#32325d] dark:text-slate-200 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#8898aa] dark:text-slate-400" />
                    <span>Security Check</span>
                  </label>
                  <button
                    type="button"
                    onClick={loadCaptcha}
                    disabled={refreshingCaptcha}
                    className="text-[13px] text-[#3970e1] dark:text-blue-400 hover:text-[#2b5cc4] dark:hover:text-blue-300 font-semibold flex items-center gap-1 transition"
                    title="Generate a new captcha"
                  >
                    <RefreshCw className={`w-3 h-3 ${refreshingCaptcha ? 'animate-spin' : ''}`} />
                    <span>Reload</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className="rounded-[0.375rem] overflow-hidden border border-[#dee2e6] dark:border-slate-700 bg-[#f8f9fe] dark:bg-slate-900 flex-shrink-0 flex items-center justify-center min-w-[130px] h-[38px]"
                    dangerouslySetInnerHTML={{ __html: captchaSvg || '<div class="text-xs text-[#8898aa] dark:text-slate-500">Loading...</div>' }}
                  />

                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value.toUpperCase())}
                    placeholder="Code"
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-center tracking-widest text-[#32325d] dark:text-slate-100 uppercase placeholder:normal-case placeholder:tracking-normal placeholder-[#8898aa] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 transition h-[38px] shadow-argon-sm"
                  />
                </div>
              </div>
            )}

            {/* 2. External Interactive Captchas (Turnstile, reCAPTCHA v2, hCaptcha) */}
            {isExternalVisible && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#32325d] dark:text-slate-200 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#8898aa] dark:text-slate-400" />
                    <span>
                      Security Check (
                      {captchaProvider === 'turnstile'
                        ? 'Turnstile'
                        : captchaProvider === 'recaptcha_v2'
                          ? 'reCAPTCHA'
                          : 'hCaptcha'}
                      )
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={loadCaptcha}
                    disabled={refreshingCaptcha}
                    className="text-[13px] text-[#3970e1] dark:text-blue-400 hover:text-[#2b5cc4] dark:hover:text-blue-300 font-semibold flex items-center gap-1 transition"
                    title="Reload challenge"
                  >
                    <RefreshCw className={`w-3 h-3 ${refreshingCaptcha ? 'animate-spin' : ''}`} />
                    <span>Reload</span>
                  </button>
                </div>

                {!captchaSiteKey ? (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-[0.375rem] text-xs text-amber-700 dark:text-amber-300">
                    Captcha site key is missing. Please configure it in system settings.
                  </div>
                ) : (
                  <div className="flex justify-center p-2 bg-[#f8f9fe] dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] min-h-[70px]">
                    <CaptchaWidget
                      ref={widgetRef}
                      provider={captchaProvider}
                      siteKey={captchaSiteKey}
                      theme={isDark ? 'dark' : 'light'}
                      onVerify={(token) => setCaptchaAnswer(token)}
                      onExpire={() => setCaptchaAnswer('')}
                      onError={() => setError('Captcha challenge verification error')}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 3. Invisible reCAPTCHA v3 */}
            {captchaProvider === 'recaptcha_v3' && (
              <>
                <CaptchaWidget
                  ref={widgetRef}
                  provider="recaptcha_v3"
                  siteKey={captchaSiteKey}
                  theme={isDark ? 'dark' : 'light'}
                  onError={() => setError('reCAPTCHA v3 failed to initialize')}
                />
                {!captchaSiteKey && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-[0.375rem] text-xs text-amber-700 dark:text-amber-300">
                    reCAPTCHA v3 site key is missing in settings.
                  </div>
                )}
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitDisabled()}
              className="w-full mt-3 py-2.5 bg-[#3970e1] hover:bg-[#2b5cc4] text-white font-bold uppercase tracking-wider rounded-[0.375rem] text-xs shadow-argon-btn flex items-center justify-center gap-1.5 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

