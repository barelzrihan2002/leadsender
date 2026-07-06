import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Link2, Loader2, RefreshCcw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import type { Account, GroupJoinByInviteResult, GroupJoinByInviteStatus, WhatsAppGroupInviteInfo } from '@/types';

type JoinRowStatus = GroupJoinByInviteStatus | 'joining';

interface JoinResultRow extends Omit<GroupJoinByInviteResult, 'status'> {
  accountId: string;
  accountName: string;
  phoneNumber: string;
  status: JoinRowStatus;
}

function getStatusClassName(status: JoinRowStatus): string {
  switch (status) {
    case 'joined':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'already_joined':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'pending_approval':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'account_restricted':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'invalid_invite':
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'account_not_connected':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'joining':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getStatusLabel(language: 'en' | 'he' | 'ar', status: JoinRowStatus): string {
  if (status === 'joining') {
    return language === 'he' ? 'מצטרף...' : language === 'ar' ? 'جارٍ الانضمام...' : 'Joining...';
  }

  if (status === 'joined') {
    return language === 'he' ? 'הצטרף' : language === 'ar' ? 'انضم' : 'Joined';
  }

  if (status === 'already_joined') {
    return language === 'he' ? 'כבר בקבוצה' : language === 'ar' ? 'موجود بالفعل' : 'Already joined';
  }

  if (status === 'pending_approval') {
    return language === 'he' ? 'ממתין לאישור מנהל' : language === 'ar' ? 'بانتظار موافقة المشرف' : 'Pending admin approval';
  }

  if (status === 'account_restricted') {
    return language === 'he'
      ? 'החשבון מוגבל זמנית ע"י וואטסאפ (נסה שוב בעוד 24-72 שעות)'
      : language === 'ar'
      ? 'الحساب مقيد مؤقتًا من واتساب (حاول مرة أخرى خلال 24-72 ساعة)'
      : 'Account temporarily restricted by WhatsApp (retry in 24-72h)';
  }

  if (status === 'invalid_invite') {
    return language === 'he' ? 'לינק לא תקין' : language === 'ar' ? 'رابط غير صالح' : 'Invalid invite';
  }

  if (status === 'account_not_connected') {
    return language === 'he' ? 'חשבון לא מחובר' : language === 'ar' ? 'الحساب غير متصل' : 'Account not connected';
  }

  return language === 'he' ? 'נכשל' : language === 'ar' ? 'فشل' : 'Failed';
}

export default function AutoGroupJoin() {
  const { language } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteInfo, setInviteInfo] = useState<WhatsAppGroupInviteInfo | null>(null);
  const [results, setResults] = useState<JoinResultRow[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingInviteInfo, setLoadingInviteInfo] = useState(false);
  const [joining, setJoining] = useState(false);

  const selectedAccounts = useMemo(
    () => accounts.filter(account => selectedAccountIds.includes(account.id)),
    [accounts, selectedAccountIds]
  );

  const previewAccountId = selectedAccountIds[0] || accounts[0]?.id || '';
  const previewAccount = accounts.find(account => account.id === previewAccountId) || null;

  useEffect(() => {
    void loadAccounts();
  }, []);

  async function loadAccounts() {
    setLoadingAccounts(true);

    try {
      const accountsData = await api.accounts.getAll();
      const connectedAccounts = accountsData.filter((account: Account) => account.status === 'connected');
      setAccounts(connectedAccounts);
      setSelectedAccountIds(prev => {
        const nextSelected = prev.filter(accountId => connectedAccounts.some(account => account.id === accountId));
        return nextSelected.length > 0 ? nextSelected : connectedAccounts.map(account => account.id);
      });
    } catch (error) {
      console.error('Failed to load accounts for auto group join:', error);
      toast.error(language === 'he' ? 'שגיאה בטעינת החשבונות' : language === 'ar' ? 'فشل تحميل الحسابات' : 'Failed to load accounts');
    } finally {
      setLoadingAccounts(false);
    }
  }

  function toggleAccount(accountId: string) {
    setSelectedAccountIds(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  }

  function handleSelectAll() {
    setSelectedAccountIds(accounts.map(account => account.id));
  }

  function handleClearSelection() {
    setSelectedAccountIds([]);
  }

  async function handlePreviewInvite() {
    if (!inviteLink.trim()) {
      toast.warning(language === 'he' ? 'הדבק קישור לקבוצה' : language === 'ar' ? 'ألصق رابط المجموعة' : 'Paste a group invite link');
      return;
    }

    if (!previewAccountId) {
      toast.warning(language === 'he' ? 'אין חשבון מחובר לבדיקת הקישור' : language === 'ar' ? 'لا يوجد حساب متصل لفحص الرابط' : 'No connected account is available to inspect the invite');
      return;
    }

    setLoadingInviteInfo(true);

    try {
      const info = await api.groups.getInviteInfo(previewAccountId, inviteLink.trim());
      setInviteInfo(info);
      setResults([]);
      toast.success(language === 'he' ? 'פרטי הקבוצה נטענו בהצלחה' : language === 'ar' ? 'تم تحميل معلومات المجموعة بنجاح' : 'Group info loaded successfully');
    } catch (error) {
      console.error('Failed to load invite info:', error);
      setInviteInfo(null);
      toast.error(language === 'he' ? 'לא ניתן לקרוא את הקישור' : language === 'ar' ? 'تعذر قراءة الرابط' : 'Failed to inspect invite link');
    } finally {
      setLoadingInviteInfo(false);
    }
  }

  async function handleJoinSelectedAccounts() {
    if (!inviteLink.trim()) {
      toast.warning(language === 'he' ? 'הדבק קישור לקבוצה' : language === 'ar' ? 'ألصق رابط المجموعة' : 'Paste a group invite link');
      return;
    }

    if (selectedAccounts.length === 0) {
      toast.warning(language === 'he' ? 'בחר לפחות חשבון אחד' : language === 'ar' ? 'اختر حسابًا واحدًا على الأقل' : 'Select at least one account');
      return;
    }

    setJoining(true);
    setResults(
      selectedAccounts.map(account => ({
        accountId: account.id,
        accountName: account.name || (language === 'he' ? 'ללא שם' : language === 'ar' ? 'بدون اسم' : 'Unnamed'),
        phoneNumber: account.phone_number,
        success: false,
        status: 'joining',
        message: language === 'he' ? 'מצטרף לקבוצה...' : language === 'ar' ? 'جارٍ الانضمام إلى المجموعة...' : 'Joining group...'
      }))
    );

    const completedRows: JoinResultRow[] = [];

    for (const account of selectedAccounts) {
      try {
        const result = await api.groups.joinGroupByInviteLink(account.id, inviteLink.trim());
        const nextRow: JoinResultRow = {
          accountId: account.id,
          accountName: account.name || (language === 'he' ? 'ללא שם' : language === 'ar' ? 'بدون اسم' : 'Unnamed'),
          phoneNumber: account.phone_number,
          ...result
        };

        completedRows.push(nextRow);
        setResults(prev => prev.map(row => row.accountId === account.id ? nextRow : row));
      } catch (error) {
        console.error(`Failed to join group for account ${account.id}:`, error);
        const failedRow: JoinResultRow = {
          accountId: account.id,
          accountName: account.name || (language === 'he' ? 'ללא שם' : language === 'ar' ? 'بدون اسم' : 'Unnamed'),
          phoneNumber: account.phone_number,
          success: false,
          status: 'failed',
          message: (error as Error).message || (language === 'he' ? 'ההצטרפות נכשלה' : language === 'ar' ? 'فشل الانضمام' : 'Join failed'),
          groupId: inviteInfo?.groupId || null,
          groupName: inviteInfo?.groupName || null
        };

        completedRows.push(failedRow);
        setResults(prev => prev.map(row => row.accountId === account.id ? failedRow : row));
      }
    }

    const successCount = completedRows.filter(row => row.success).length;
    const pendingCount = completedRows.filter(row => row.status === 'pending_approval').length;
    const failedCount = completedRows.length - successCount - pendingCount;

    if (failedCount === 0 && pendingCount === 0) {
      toast.success(
        language === 'he'
          ? `${successCount} חשבונות סיימו להצטרף לקבוצה בהצלחה`
          : language === 'ar'
          ? `تمت إضافة ${successCount} حسابات إلى المجموعة بنجاح`
          : `${successCount} accounts joined the group successfully`
      );
    } else if (failedCount === 0 && pendingCount > 0) {
      toast.warning(
        language === 'he'
          ? `${successCount} הצטרפו, ${pendingCount} ממתינים לאישור מנהל הקבוצה`
          : language === 'ar'
          ? `${successCount} انضموا، ${pendingCount} بانتظار موافقة المشرف`
          : `${successCount} joined, ${pendingCount} pending admin approval`
      );
    } else {
      toast.warning(
        language === 'he'
          ? `${successCount} הצליחו, ${pendingCount} ממתינים לאישור, ${failedCount} נכשלו`
          : language === 'ar'
          ? `${successCount} نجحوا، ${pendingCount} بانتظار الموافقة، ${failedCount} فشلوا`
          : `${successCount} succeeded, ${pendingCount} pending approval, ${failedCount} failed`
      );
    }

    setJoining(false);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          {language === 'he' ? 'Auto Group Join' : language === 'ar' ? 'الانضمام التلقائي للمجموعة' : 'Auto Group Join'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {language === 'he'
            ? 'הדבק קישור הזמנה, בחר חשבונות, וכל החשבונות הנבחרים יצטרפו לקבוצה.'
            : language === 'ar'
            ? 'ألصق رابط الدعوة، اختر الحسابات، وكل الحسابات المحددة ستنضم إلى المجموعة.'
            : 'Paste a group invite link, choose accounts, and all selected accounts will join the group.'}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-blue-600" />
              {language === 'he' ? 'קישור הזמנה לקבוצה' : language === 'ar' ? 'رابط دعوة المجموعة' : 'Group Invite Link'}
            </CardTitle>
            <CardDescription>
              {language === 'he'
                ? 'תוכל להדביק לינק מלא של WhatsApp או רק את קוד ההזמנה.'
                : language === 'ar'
                ? 'يمكنك لصق رابط واتساب الكامل أو رمز الدعوة فقط.'
                : 'You can paste the full WhatsApp link or just the invite code.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={inviteLink}
              onChange={(event) => {
                setInviteLink(event.target.value);
                setInviteInfo(null);
                setResults([]);
              }}
              placeholder="https://chat.whatsapp.com/..."
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handlePreviewInvite} disabled={loadingInviteInfo || joining || !inviteLink.trim()} variant="outline" className="gap-2 sm:flex-1">
                {loadingInviteInfo ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {language === 'he' ? 'בודק...' : language === 'ar' ? 'جارٍ الفحص...' : 'Checking...'}
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-4 w-4" />
                    {language === 'he' ? 'בדוק קבוצה' : language === 'ar' ? 'فحص المجموعة' : 'Inspect Group'}
                  </>
                )}
              </Button>

              <Button onClick={handleJoinSelectedAccounts} disabled={joining || selectedAccounts.length === 0 || !inviteLink.trim()} className="gap-2 sm:flex-1">
                {joining ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {language === 'he' ? 'מצרף חשבונות...' : language === 'ar' ? 'جارٍ ضم الحسابات...' : 'Joining accounts...'}
                  </>
                ) : (
                  <>
                    {language === 'he'
                      ? `צרף ${selectedAccounts.length} חשבונות`
                      : language === 'ar'
                      ? `ضم ${selectedAccounts.length} حسابات`
                      : `Join ${selectedAccounts.length} Accounts`}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
          <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <CardHeader>
            <CardTitle>
              {language === 'he' ? 'תצוגה מקדימה של הקבוצה' : language === 'ar' ? 'معاينة المجموعة' : 'Group Preview'}
            </CardTitle>
            <CardDescription>
              {previewAccount
                ? language === 'he'
                  ? `בדיקה דרך החשבון ${previewAccount.name || previewAccount.phone_number}`
                  : language === 'ar'
                  ? `يتم الفحص عبر الحساب ${previewAccount.name || previewAccount.phone_number}`
                  : `Inspecting via ${previewAccount.name || previewAccount.phone_number}`
                : language === 'he'
                ? 'בחר חשבון מחובר כדי לקרוא את פרטי הקבוצה.'
                : language === 'ar'
                ? 'اختر حسابًا متصلًا لقراءة معلومات المجموعة.'
                : 'Choose a connected account to inspect the group.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inviteInfo ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{inviteInfo.groupName}</h3>
                    <p className="text-sm text-muted-foreground break-all">{inviteInfo.groupId || inviteInfo.inviteCode}</p>
                  </div>
                  {inviteInfo.participantCount !== null && inviteInfo.participantCount !== undefined && (
                    <Badge variant="secondary">
                      {inviteInfo.participantCount} {language === 'he' ? 'משתתפים' : language === 'ar' ? 'أعضاء' : 'participants'}
                    </Badge>
                  )}
                </div>

                {inviteInfo.description && (
                  <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                    {inviteInfo.description}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground text-center">
                {language === 'he'
                  ? 'עדיין לא נטענה תצוגה מקדימה. הדבק קישור ולחץ על "בדוק קבוצה".'
                  : language === 'ar'
                  ? 'لم يتم تحميل المعاينة بعد. ألصق الرابط واضغط "فحص المجموعة".'
                  : 'No preview loaded yet. Paste the link and click "Inspect Group".'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-500"></div>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                {language === 'he' ? 'בחירת חשבונות' : language === 'ar' ? 'اختيار الحسابات' : 'Choose Accounts'}
              </CardTitle>
              <CardDescription>
                {language === 'he'
                  ? `נבחרו ${selectedAccounts.length} מתוך ${accounts.length} חשבונות מחוברים`
                  : language === 'ar'
                  ? `تم اختيار ${selectedAccounts.length} من أصل ${accounts.length} حسابات متصلة`
                  : `${selectedAccounts.length} of ${accounts.length} connected accounts selected`}
              </CardDescription>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleSelectAll} disabled={accounts.length === 0 || joining}>
                {language === 'he' ? 'בחר הכל' : language === 'ar' ? 'اختر الكل' : 'Select All'}
              </Button>
              <Button type="button" variant="outline" onClick={handleClearSelection} disabled={selectedAccounts.length === 0 || joining}>
                {language === 'he' ? 'נקה בחירה' : language === 'ar' ? 'مسح التحديد' : 'Clear Selection'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAccounts ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {language === 'he' ? 'טוען חשבונות...' : language === 'ar' ? 'جارٍ تحميل الحسابات...' : 'Loading accounts...'}
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
              {language === 'he' ? 'אין כרגע חשבונות מחוברים' : language === 'ar' ? 'لا توجد حسابات متصلة حاليًا' : 'There are no connected accounts right now'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {accounts.map(account => {
                const isSelected = selectedAccountIds.includes(account.id);

                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => toggleAccount(account.id)}
                    disabled={joining}
                    className={`text-left flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                        : 'border-border/50 hover:border-primary/40 hover:bg-accent/40'
                    } ${joining ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="relative">
                      {account.profile_picture_url ? (
                        <img src={account.profile_picture_url} alt="" className="h-14 w-14 rounded-full object-cover shadow-sm border-2 border-background" />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center border-2 border-background shadow-sm">
                          <Users className="h-7 w-7 text-primary" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">
                        {account.name || (language === 'he' ? 'ללא שם' : language === 'ar' ? 'بدون اسم' : 'Unnamed')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate font-mono">{account.phone_number}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
          <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 to-amber-500"></div>
          <CardHeader>
            <CardTitle>
              {language === 'he' ? 'תוצאות ההצטרפות' : language === 'ar' ? 'نتائج الانضمام' : 'Join Results'}
            </CardTitle>
            <CardDescription>
              {inviteInfo?.groupName || (language === 'he' ? 'קבוצת יעד' : language === 'ar' ? 'المجموعة المستهدفة' : 'Target Group')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">
                        {language === 'he' ? 'חשבון' : language === 'ar' ? 'الحساب' : 'Account'}
                      </th>
                      <th className="text-left p-3 text-sm font-medium">
                        {language === 'he' ? 'סטטוס' : language === 'ar' ? 'الحالة' : 'Status'}
                      </th>
                      <th className="text-left p-3 text-sm font-medium">
                        {language === 'he' ? 'הודעה' : language === 'ar' ? 'الرسالة' : 'Message'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(result => (
                      <tr key={result.accountId} className="border-t hover:bg-accent/30 transition-colors">
                        <td className="p-3">
                          <div>
                            <p className="text-sm font-medium">{result.accountName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{result.phoneNumber}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className={getStatusClassName(result.status)}>
                            {getStatusLabel(language, result.status)}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">{result.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
