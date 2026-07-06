import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCcw, Upload, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import type { Account, WhatsAppGroupSummary } from '@/types';

const DAY_KEYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABELS: Record<'he' | 'ar' | 'en', string[]> = {
  he: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
  ar: ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

export default function CreateGroupsCampaignPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const isEditMode = Boolean(campaignId);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const dayLabels = DAY_LABELS[language as 'he' | 'ar' | 'en'] || DAY_LABELS.en;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<WhatsAppGroupSummary[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [message, setMessage] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [days, setDays] = useState<number[]>([]);
  const [sendHour, setSendHour] = useState(9);
  const [sendMinute, setSendMinute] = useState(0);
  const [minDelay, setMinDelay] = useState(20);
  const [maxDelay, setMaxDelay] = useState(60);

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [existingMediaPath, setExistingMediaPath] = useState<string>('');

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!accountId) {
      setGroups([]);
      return;
    }
    void loadGroups(accountId);
  }, [accountId]);

  async function loadInitialData() {
    try {
      const accountsData = await api.accounts.getAll();
      setAccounts(accountsData);

      if (isEditMode && campaignId) {
        const campaign = await api.groupCampaigns.getById(campaignId);
        if (!campaign) {
          toast.error(language === 'he' ? 'קמפיין לא נמצא' : language === 'ar' ? 'الحملة غير موجودة' : 'Campaign not found');
          navigate('/groups-campaigns');
          return;
        }

        setName(campaign.name);
        setAccountId(campaign.account_id);
        setMessage(campaign.message || '');
        setDays(campaign.days_of_week || []);
        setSendHour(campaign.send_hour);
        setSendMinute(campaign.send_minute);
        setMinDelay(campaign.min_delay);
        setMaxDelay(campaign.max_delay);

        if (campaign.media_path) {
          setExistingMediaPath(campaign.media_path);
          setMediaType(campaign.media_type || null);
          setMediaPreview(campaign.media_path);
        }

        const targets = await api.groupCampaigns.getTargets(campaignId);
        setSelectedGroupIds(targets.map(t => t.group_id));
      }
    } catch (error) {
      console.error('Failed to load group campaign editor data:', error);
      toast.error(language === 'he' ? 'שגיאה בטעינת הנתונים' : language === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data');
    } finally {
      setLoadingInitial(false);
    }
  }

  async function loadGroups(accId: string) {
    setLoadingGroups(true);
    try {
      const data = await api.groups.getGroups(accId);
      setGroups(data);
    } catch (error) {
      console.error('Failed to load groups:', error);
      toast.error(language === 'he' ? 'שגיאה בטעינת הקבוצות' : language === 'ar' ? 'فشل تحميل المجموعات' : 'Failed to load groups');
    } finally {
      setLoadingGroups(false);
    }
  }

  function toggleDay(day: number) {
    setDays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]));
  }

  function toggleGroup(groupId: string) {
    setSelectedGroupIds(prev => (prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]));
  }

  function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaFile(file);
    setExistingMediaPath('');

    if (file.type.startsWith('image/')) {
      setMediaType('image');
    } else if (file.type.startsWith('video/')) {
      setMediaType('video');
    } else {
      toast.warning(language === 'he' ? 'ניתן לצרף רק תמונה או סרטון' : language === 'ar' ? 'يمكن إرفاق صورة أو فيديو فقط' : 'Only image or video files are supported');
      setMediaFile(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setMediaPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function removeMedia() {
    setMediaFile(null);
    setMediaPreview('');
    setMediaType(null);
    setExistingMediaPath('');
  }

  const selectedGroupSummaries = useMemo(
    () => groups.filter(g => selectedGroupIds.includes(g.id)),
    [groups, selectedGroupIds]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.warning(language === 'he' ? 'יש להזין שם לקמפיין' : language === 'ar' ? 'يرجى إدخال اسم للحملة' : 'Please enter a campaign name');
      return;
    }
    if (!accountId) {
      toast.warning(language === 'he' ? 'יש לבחור חשבון מקור' : language === 'ar' ? 'يرجى اختيار حساب مصدر' : 'Please choose a source account');
      return;
    }
    if (selectedGroupIds.length === 0) {
      toast.warning(language === 'he' ? 'יש לבחור לפחות קבוצה אחת' : language === 'ar' ? 'يرجى اختيار مجموعة واحدة على الأقل' : 'Please choose at least one group');
      return;
    }
    if (!message.trim() && !mediaFile && !existingMediaPath) {
      toast.warning(language === 'he' ? 'יש להזין הודעה או לצרף מדיה' : language === 'ar' ? 'يرجى إدخال رسالة أو إرفاق وسائط' : 'Please enter a message or attach media');
      return;
    }
    if (days.length === 0) {
      toast.warning(language === 'he' ? 'יש לבחור לפחות יום אחד' : language === 'ar' ? 'يرجى اختيار يوم واحد على الأقل' : 'Please choose at least one day');
      return;
    }

    setLoading(true);
    try {
      let mediaPath = existingMediaPath;

      if (mediaFile) {
        const arrayBuffer = await mediaFile.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        mediaPath = await api.campaigns.saveMedia(mediaFile.name, buffer as any);
      }

      const targets = selectedGroupSummaries.map(g => ({ group_id: g.id, group_name: g.name }));

      const payload = {
        name: name.trim(),
        account_id: accountId,
        message: message.trim(),
        media_path: mediaPath || undefined,
        media_type: mediaPath ? (mediaType || undefined) : undefined,
        media_caption: mediaPath ? message.trim() : undefined,
        days_of_week: days,
        send_hour: sendHour,
        send_minute: sendMinute,
        min_delay: minDelay,
        max_delay: maxDelay,
        targets,
      };

      if (isEditMode && campaignId) {
        await api.groupCampaigns.update(campaignId, payload);
        toast.success(language === 'he' ? 'הקמפיין עודכן בהצלחה' : language === 'ar' ? 'تم تحديث الحملة بنجاح' : 'Campaign updated successfully');
      } else {
        await api.groupCampaigns.create(payload);
        toast.success(language === 'he' ? 'הקמפיין נוצר בהצלחה' : language === 'ar' ? 'تم إنشاء الحملة بنجاح' : 'Campaign created successfully');
      }

      navigate('/groups-campaigns');
    } catch (error) {
      console.error('Failed to save group campaign:', error);
      toast.error(language === 'he' ? 'שגיאה בשמירת הקמפיין' : language === 'ar' ? 'فشل حفظ الحملة' : 'Failed to save campaign');
    } finally {
      setLoading(false);
    }
  }

  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {isEditMode
              ? (language === 'he' ? 'עריכת קמפיין קבוצות' : language === 'ar' ? 'تعديل حملة المجموعات' : 'Edit groups campaign')
              : (language === 'he' ? 'קמפיין קבוצות חדש' : language === 'ar' ? 'حملة مجموعات جديدة' : 'New groups campaign')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'he'
              ? 'פרסום מתוזמן וחוזר להודעה/מדיה בקבוצות שנבחרו'
              : language === 'ar'
              ? 'نشر مجدول ومتكرر لرسالة/وسائط في المجموعات المختارة'
              : 'Scheduled, recurring posting of a message/media to the selected groups'}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => navigate('/groups-campaigns')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {language === 'he' ? 'חזרה' : language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'he' ? 'פרטי קמפיין' : language === 'ar' ? 'تفاصيل الحملة' : 'Campaign details'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{language === 'he' ? 'שם קמפיין' : language === 'ar' ? 'اسم الحملة' : 'Campaign name'}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={language === 'he' ? 'לדוגמה: פרסום שבועי' : 'e.g. Weekly promo'} />
          </div>

          <div className="space-y-2">
            <Label>{language === 'he' ? 'חשבון מקור' : language === 'ar' ? 'حساب المصدر' : 'Source account'}</Label>
            <select
              value={accountId}
              onChange={(e) => { setAccountId(e.target.value); setSelectedGroupIds([]); }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{language === 'he' ? 'בחר חשבון' : language === 'ar' ? 'اختر حساباً' : 'Select an account'}</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name || acc.phone_number}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>{language === 'he' ? 'הודעה' : language === 'ar' ? 'الرسالة' : 'Message'}</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={language === 'he' ? 'תוכן ההודעה שתפורסם בקבוצות' : 'Message content to post to the groups'}
              className="min-h-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label>{language === 'he' ? 'מדיה (תמונה/סרטון) - אופציונלי' : language === 'ar' ? 'وسائط (صورة/فيديو) - اختياري' : 'Media (image/video) - optional'}</Label>
            {mediaPreview ? (
              <div className="relative inline-block">
                {mediaType === 'video' ? (
                  <video src={mediaPreview} className="h-40 rounded-lg border" controls />
                ) : (
                  <img src={mediaPreview} alt="preview" className="h-40 rounded-lg border object-cover" />
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-7 w-7 p-0 rounded-full"
                  onClick={removeMedia}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  id="group-campaign-media-upload"
                  className="hidden"
                  accept="image/*,video/*"
                  onChange={handleMediaUpload}
                />
                <Button type="button" variant="outline" onClick={() => document.getElementById('group-campaign-media-upload')?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {language === 'he' ? 'העלה מדיה' : language === 'ar' ? 'تحميل وسائط' : 'Upload media'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{language === 'he' ? 'בחירת קבוצות' : language === 'ar' ? 'اختيار المجموعات' : 'Group selection'}</CardTitle>
            {accountId && (
              <Button type="button" variant="outline" size="sm" onClick={() => void loadGroups(accountId)} disabled={loadingGroups}>
                <RefreshCcw className={`h-4 w-4 mr-2 ${loadingGroups ? 'animate-spin' : ''}`} />
                {language === 'he' ? 'רענן קבוצות' : language === 'ar' ? 'تحديث المجموعات' : 'Refresh groups'}
              </Button>
            )}
          </div>
          <CardDescription>
            {language === 'he'
              ? 'בחר קבוצה אחת או יותר שהחשבון חבר בהן.'
              : language === 'ar'
              ? 'اختر مجموعة واحدة أو أكثر ينتمي إليها الحساب.'
              : 'Choose one or more groups the account is a member of.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!accountId ? (
            <p className="text-sm text-muted-foreground">
              {language === 'he' ? 'בחר חשבון כדי לטעון את הקבוצות שלו' : language === 'ar' ? 'اختر حساباً لتحميل مجموعاته' : 'Select an account to load its groups'}
            </p>
          ) : loadingGroups ? (
            <p className="text-sm text-muted-foreground">{language === 'he' ? 'טוען קבוצות...' : language === 'ar' ? 'جار تحميل المجموعات...' : 'Loading groups...'}</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{language === 'he' ? 'לא נמצאו קבוצות עבור חשבון זה' : language === 'ar' ? 'لم يتم العثور على مجموعات لهذا الحساب' : 'No groups found for this account'}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 max-h-80 overflow-y-auto pr-1">
              {groups.map(group => (
                <label key={group.id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/40">
                  <Checkbox checked={selectedGroupIds.includes(group.id)} onCheckedChange={() => toggleGroup(group.id)} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.participantCount} {language === 'he' ? 'משתתפים' : language === 'ar' ? 'مشاركين' : 'participants'}
                      {!group.isAdmin && (language === 'he' ? ' · לא מנהל' : language === 'ar' ? ' · ليس مشرفاً' : ' · not admin')}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'he' ? 'תזמון' : language === 'ar' ? 'الجدولة' : 'Schedule'}</CardTitle>
          <CardDescription>
            {language === 'he'
              ? 'בחר באילו ימים ובאיזו שעה תפורסם ההודעה, כל שבוע עד עצירה ידנית.'
              : language === 'ar'
              ? 'اختر الأيام والوقت الذي سيتم فيه النشر، كل أسبوع حتى الإيقاف اليدوي.'
              : 'Choose which days and time to post, every week until manually stopped.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DAY_KEYS.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                  days.includes(day)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:bg-accent/40'
                }`}
              >
                {dayLabels[day]}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{language === 'he' ? 'שעה' : language === 'ar' ? 'الساعة' : 'Hour'}</Label>
              <Input type="number" min={0} max={23} value={sendHour} onChange={(e) => setSendHour(Math.min(23, Math.max(0, Number(e.target.value))))} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'he' ? 'דקה' : language === 'ar' ? 'الدقيقة' : 'Minute'}</Label>
              <Input type="number" min={0} max={59} value={sendMinute} onChange={(e) => setSendMinute(Math.min(59, Math.max(0, Number(e.target.value))))} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{language === 'he' ? 'עיכוב מינימלי בין קבוצות (שניות)' : language === 'ar' ? 'أدنى تأخير بين المجموعات (ثوانٍ)' : 'Min delay between groups (seconds)'}</Label>
              <Input type="number" min={1} value={minDelay} onChange={(e) => setMinDelay(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'he' ? 'עיכוב מקסימלי בין קבוצות (שניות)' : language === 'ar' ? 'أقصى تأخير بين المجموعات (ثوانٍ)' : 'Max delay between groups (seconds)'}</Label>
              <Input type="number" min={1} value={maxDelay} onChange={(e) => setMaxDelay(Number(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate('/groups-campaigns')}>
          {language === 'he' ? 'ביטול' : language === 'ar' ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading
            ? (language === 'he' ? 'שומר...' : language === 'ar' ? 'جار الحفظ...' : 'Saving...')
            : isEditMode
            ? (language === 'he' ? 'שמור שינויים' : language === 'ar' ? 'حفظ التغييرات' : 'Save changes')
            : (language === 'he' ? 'צור קמפיין' : language === 'ar' ? 'إنشاء حملة' : 'Create campaign')}
        </Button>
      </div>
    </form>
  );
}
