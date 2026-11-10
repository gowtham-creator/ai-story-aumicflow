'use client';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '@/store/auth-store';
import { useChatStore } from '@/store/chat-store';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export default function AuthPage() {
  const { setUser, googleLogin } = useAuthStore();
  const { clearAllConversations, fetchUserHistory } = useChatStore();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse: any) => {
    const token = credentialResponse?.credential;
    if (!token) return;

    const ok = await googleLogin(token);
    if (ok) {
      await clearAllConversations();
      await fetchUserHistory();
      toast({ title: '✅ Logged in with Google' });
      navigate('/chat');
    } else {
      toast({ title: '❌ Google login failed', variant: 'destructive' });
    }
  };

  const handleGoogleError = () => {
    toast({ title: 'Google Sign-In failed', variant: 'destructive' });
  };

  const handleGuestLogin = () => {
    setUser({
      id: 'guest-' + Date.now(),
      email: 'guest@example.com',
      name: 'Guest User',
    });
    navigate('/chat');
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#f7f1ea]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#fdfaf6] via-[#f6efe8] to-[#efe3d8]" />
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.6),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(227,123,83,0.15),_transparent_60%)]" />

      {/* use the uploaded image path as the background image source */}
      <img
        src="/sketch8.jpg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 h-full w-full object-cover opacity-30"
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header: reduced height so it doesn't take too much space */}
        <header className="flex w-full items-center justify-between px-4 sm:px-8 lg:px-12 h-20 lg:h-24">
          <img
            src="/sketch9.png"
            alt="logo"
            className="h-12 lg:h-16 w-auto"
          />

          <Button
            onClick={handleGuestLogin}
            variant="ghost"
            className="h-10 px-4 rounded-2xl border border-dashed border-[#E37B53]/40 bg-[#E37B53] text-white hover:bg-white/70 hover:text-[#E37B53]"
          >
            Continue as guest
          </Button>
        </header>

        {/* Main: make items vertically centered so left text lines up with the image */}
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 pb-16 sm:px-8 lg:flex-row items-center lg:gap-16">
          {/* Left Section */}
          <section className="w-full max-w-2xl text-center sm:mx-auto lg:mx-0 lg:w-1/2 lg:text-left flex flex-col justify-center py-8">
            <p className="text-sm uppercase tracking-[0.4em] text-[#C3A58C]">
              rooted in indian emotion
            </p>

            <h1 className="mt-4 font-serif text-4xl leading-tight text-[#3B2F2F] sm:text-5xl lg:text-6xl">
              Words that carry the warmth of home.
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-[#5F5449] sm:text-xl">
              Aumic Flow understands the pause between two Hindi words, the softness
              in a Telugu lullaby, the playful sarcasm hidden inside Bengali wit.
              It doesn’t just translate—it feels, remembers, and writes like someone
              who grew up listening to the same stories.
            </p>

            {/* Google Login Button: constrained width and centered */}
            <div className="mt-8 flex justify-center">
              <div className="w-full max-w-[280px] rounded-2xl border border-[#D0C8BD] bg-white/90 p-3 shadow-md">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="outline"
                  size="large"
                />
              </div>
            </div>
          </section>

          {/* Right Section */}
          <section className="relative w-full max-w-lg mx-auto lg:mx-0 lg:w-1/2">
            <div className="mx-auto max-w-md rounded-[32px] border border-[#F2E4D8] bg-white/90 p-4 shadow-xl backdrop-blur">
              <div className="relative overflow-hidden rounded-[28px] bg-[#f7e6db]">
                <img
                  src="/sketch4.png"
                  alt="Illustration of an author immersed in storytelling"
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-4 left-4 rounded-full bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#C58F6B]">
                  crafted in india
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-[#FDF9F5] p-4 text-left">
                <p className="text-sm uppercase tracking-[0.4em] text-[#C3A58C]">
                  sample line
                </p>
                <p className="mt-2 font-serif text-xl text-[#3B2F2F]">
                  “Maa ke haath ki chai ki khushboo, ab har kahaani mein bas jaayegi.”
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
