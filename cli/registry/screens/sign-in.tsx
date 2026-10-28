import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Mail, Loader2, CircleAlert, Check } from 'lucide-react';
import { Brand, GoogleG, Mark } from '~components/brand';
import { Button } from '~components/button';
import { Field, Input } from '~components/field';
import { Segmented } from '~components/choice';
import { cn } from '~components/cn';

type Step = 'email' | 'code' | 'verifying' | 'wrong' | 'welcome';

/** Email first, then a 6 digit code. No passwords. Codes expire after 10 minutes. */
export default function SignIn() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [lang, setLang] = useState<'en' | 'vi'>('en');
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const nav = useNavigate();

  useEffect(() => {
    if (step === 'verifying') { const h = setTimeout(() => setStep(code.join('') === '000000' ? 'wrong' : 'welcome'), 900); return () => clearTimeout(h); }
    if (step === 'welcome') { const h = setTimeout(() => nav('/apply'), 1600); return () => clearTimeout(h); }
  }, [step, code, nav]);

  const submitEmail = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Use a full email, like name@example.com');
    setError(''); setStep('code'); setTimeout(() => boxes.current[0]?.focus(), 0);
  };
  const type = (i: number, v: string) => {
    const ds = v.replace(/\D/g, '');
    // A pasted code fills the boxes from here on; a single key fills one.
    const fill = ds.length > 1 ? ds.slice(0, 6 - i).split('') : [ds.slice(-1)];
    const next = code.map((c, j) => (j >= i && j < i + fill.length ? fill[j - i] : c));
    setCode(next);
    const last = i + fill.length;
    if (fill[0] && last <= 5) boxes.current[last]?.focus();
    if (next.every(Boolean)) setStep('verifying');
  };

  return (
    <div className="grid h-dvh min-h-[640px] grid-cols-1 bg-surface lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10 sm:py-8">
        <div className="flex items-center justify-between">
          <Brand size={15} />
          <Segmented label="Language" value={lang} onChange={setLang} options={[{ value: 'en', label: 'EN' }, { value: 'vi', label: 'VI' }]} />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-[340px] max-w-full flex-col gap-5">
            {step === 'email' && (<>
              <h1 className="flex justify-center"><Brand lead="Log in to" size={26} /></h1>
              <Button variant="secondary" size="lg" className="h-[46px] rounded-tile" icon={<GoogleG size={17} />}>Continue with Google</Button>
              <div className="flex items-center gap-3 text-small text-fg-3"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
              <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submitEmail(); }}>
                <Field label="Email" error={error}>
                  {(id, d) => <Input id={id} aria-describedby={d} invalid={!!error} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email address" className="h-10 rounded-tile" />}
                </Field>
                <Button variant="primary" size="lg" className="h-[46px] rounded-tile" type="submit">Continue</Button>
              </form>
              <p className="text-center text-small text-fg-3">We'll email you a 6-digit code.</p>
            </>)}
            {(step === 'code' || step === 'verifying' || step === 'wrong') && (<>
              <div className="flex flex-col items-center gap-1.5 text-center">
                <h1 className="text-[26px] font-semibold tracking-[-0.7px]">Check your email</h1>
                <p className="text-fg-2">We sent a 6-digit code to</p>
                <p><span className="font-medium">{email || 'linh.nguyen@gmail.com'}</span> <button onClick={() => setStep('email')} className="text-fg-3 hover:text-fg">Change</button></p>
              </div>
              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                {code.map((c, i) => (<span key={i} className="contents">
                  {i === 3 && <span className="h-px w-2 shrink-0 bg-border-strong" />}
                  <input ref={(el) => { boxes.current[i] = el; }} value={c} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={`Digit ${i + 1}`} disabled={step === 'verifying'}
                    onChange={(e) => type(i, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Backspace' && !c && i > 0) boxes.current[i - 1]?.focus(); }}
                    className={cn('h-12 w-12 min-w-0 flex-1 sm:flex-none rounded-tile text-center text-[22px] font-medium outline-none ring-1 ring-inset', step === 'wrong' ? 'bg-danger-soft/50 ring-danger' : c ? 'bg-subtle ring-transparent' : 'bg-surface ring-border focus:ring-[1.5px] focus:ring-fg')} />
                </span>))}
              </div>
              {step === 'verifying' && <p className="flex items-center justify-center gap-2 text-fg-2"><Loader2 className="size-4 animate-spin" />Verifying...</p>}
              {step === 'wrong' && <p className="flex items-center justify-center gap-1.5 text-danger"><CircleAlert className="size-3.5" />That code is incorrect or expired.</p>}
              {step !== 'verifying' && <Button variant="secondary" size="lg" className="h-10 rounded-tile" icon={<Mail className="size-4" />}>Open email</Button>}
              <p className="text-center text-small text-fg-3">Didn't get it? {step === 'wrong'
                ? <button className="font-medium text-fg" onClick={() => { setCode(Array(6).fill('')); setStep('code'); setTimeout(() => boxes.current[0]?.focus(), 0); }}>Send a new code</button>
                : <span>Resend in 0:42</span>}</p>
            </>)}
            {step === 'welcome' && (
              <div className="flex flex-col items-center gap-6">
                <h1><Brand lead="Welcome to" size={30} /></h1>
                <ul className="flex flex-col gap-2.5">
                  <li className="flex items-center gap-2 text-fg-3"><Check className="size-4" />Account created</li>
                  <li className="flex items-center gap-2 text-fg-3"><Check className="size-4" />Workspace ready</li>
                  <li className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />Getting your coach ready</li>
                </ul>
              </div>
            )}
          </div>
        </div>
        <p className="text-center text-small text-fg-3">By continuing, you agree to the Terms of Service and Privacy Policy.</p>
      </div>
      <div className="relative hidden overflow-hidden bg-[#06070B] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_100%_55%,rgb(126_147_247/0.18),transparent),radial-gradient(70%_60%_at_50%_70%,rgb(176_140_245/0.08),transparent)]" />
        <p className="relative px-14 pt-14 text-[30px] leading-[1.15] font-semibold tracking-[-0.8px] text-white">Write your CV with a coach.<br />Track every application.</p>
        <div className="absolute top-[36%] left-1/2 -translate-x-1/2 text-[#0B0C10] drop-shadow-[0_0_1px_rgb(126_147_247)] [filter:drop-shadow(0_0_24px_rgb(126_147_247/0.35))]">
          <div className="rounded-[22px] bg-[linear-gradient(135deg,#7AD3E3,#7E93F7_45%,#B08CF5)] p-[2px]">
            <div className="rounded-[20px] bg-[#0B0C10] p-6 text-[#15171E]"><Mark size={220} className="text-[#1A1C24]" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
