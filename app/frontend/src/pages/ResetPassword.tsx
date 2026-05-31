import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import AppLogo from '@/components/AppLogo';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  useEffect(() => {
    // Supabase automatically handles the recovery token from the URL hash
    // and sets the session. We listen for the PASSWORD_RECOVERY event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Also check if we already have a session (user might have landed here with token already processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error(isAr ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error(isAr ? 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        isAr
          ? 'تم تحديث كلمة المرور بنجاح! يمكنك تسجيل الدخول الآن.'
          : 'Password updated successfully! You can now sign in.'
      );
      // Sign out so user can log in fresh with new password
      await supabase.auth.signOut();
      navigate('/login');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <AppLogo className="w-20 h-20 mb-4 mx-auto" />
          <h1 className="text-3xl font-bold text-foreground">AmanahLife</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isAr ? 'إعادة تعيين كلمة المرور' : 'Reset Your Password'}
          </p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-center">
              {isAr ? 'كلمة مرور جديدة' : 'New Password'}
            </CardTitle>
            <CardDescription className="text-center">
              {sessionReady
                ? (isAr ? 'أدخل كلمة المرور الجديدة أدناه' : 'Enter your new password below')
                : (isAr ? 'جاري التحقق من الرابط...' : 'Verifying your reset link...')}
            </CardDescription>
          </CardHeader>

          {sessionReady ? (
            <form onSubmit={handleResetPassword}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">
                    {isAr ? 'كلمة المرور الجديدة' : 'New Password'}
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">
                    {isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={loading}
                >
                  {loading
                    ? (isAr ? 'جاري التحديث...' : 'Updating...')
                    : (isAr ? 'تحديث كلمة المرور' : 'Update Password')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate('/login')}
                >
                  {isAr ? 'العودة لتسجيل الدخول' : 'Back to Login'}
                </Button>
              </CardFooter>
            </form>
          ) : (
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">
                  {isAr ? 'جاري التحقق...' : 'Verifying...'}
                </p>
                <Button
                  variant="ghost"
                  className="mt-4"
                  onClick={() => navigate('/login')}
                >
                  {isAr ? 'العودة لتسجيل الدخول' : 'Back to Login'}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}