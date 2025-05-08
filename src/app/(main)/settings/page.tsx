
'use client';

import type { NextPage } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';

const SettingsPage: NextPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, translate } = useLanguage();

  return (
    <div>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{translate('settings.notifications.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-notifications">{translate('settings.notifications.email')}</Label>
              <Switch id="email-notifications" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="push-notifications">{translate('settings.notifications.push')}</Label>
              <Switch id="push-notifications" />
            </div>
             <div className="flex items-center justify-between">
              <Label htmlFor="alert-sound">{translate('settings.notifications.sound')}</Label>
              <Switch id="alert-sound" defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{translate('settings.theme.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex items-center justify-between">
              <Label htmlFor="dark-mode">{translate('settings.theme.darkMode')}</Label>
              <Switch id="dark-mode" checked={theme === 'dark'} onCheckedChange={toggleTheme} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="language-select">{translate('settings.theme.language')}</Label>
              <Select value={language} onValueChange={(value) => setLanguage(value as 'en' | 'es')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={translate('settings.theme.selectLanguage')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{translate('languages.en')}</SelectItem>
                  <SelectItem value="es">{translate('languages.es')}</SelectItem>
                  {/* Add more languages here */}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

         <Card>
          <CardHeader>
            <CardTitle>{translate('settings.data.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <Button variant="outline">{translate('settings.data.export')}</Button>
             <Button variant="destructive">{translate('settings.data.deleteAccount')}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;

