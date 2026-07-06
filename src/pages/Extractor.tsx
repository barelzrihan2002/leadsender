import { useState, useEffect } from 'react';
import { Download, Users, UserPlus, ArrowRight, Loader2, Check, Crown, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import type { Account, Tag } from '@/types';
import * as XLSX from 'xlsx';

interface Group {
  id: string;
  name: string;
  participantCount: number;
  description: string;
  isAdmin: boolean;
}

interface Participant {
  id: string;
  phoneNumber: string;
  name: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  sourceGroupIds: string[];
  sourceGroupNames: string[];
}

export default function Extractor() {
  const { language } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [step, setStep] = useState<'account' | 'groups' | 'participants'>('account');
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const selectedGroups = groups.filter(group => selectedGroupIds.includes(group.id));

  useEffect(() => {
    loadAccounts();
    loadTags();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await api.accounts.getAll();
      const connectedAccounts = data.filter(acc => acc.status === 'connected');
      setAccounts(connectedAccounts);
      
      if (connectedAccounts.length === 1) {
        setSelectedAccountId(connectedAccounts[0].id);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
      toast.error(language === 'he' ? 'שגיאה בטעינת חשבונות' : language === 'ar' ? 'خطأ في تحميل الحسابات' : 'Failed to load accounts');
    }
  };

  const loadTags = async () => {
    try {
      const data = await api.tags.getAll();
      setTags(data.filter(t => !t.is_system));
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleLoadGroups = async () => {
    if (!selectedAccountId) {
      toast.warning(language === 'he' ? 'בחר חשבון' : language === 'ar' ? 'اختر حساباً' : 'Select an account');
      return;
    }

    setLoadingGroups(true);
    try {
      const groupsData = await api.extractor.getGroups(selectedAccountId);
      setGroups(groupsData);
      setSelectedGroupIds([]);
      setParticipants([]);
      setStep('groups');
      
      toast.success(
        language === 'he' 
          ? `נמצאו ${groupsData.length} קבוצות`
          : language === 'ar'
          ? `تم العثور على ${groupsData.length} مجموعات`
          : `Found ${groupsData.length} groups`
      );
    } catch (error) {
      console.error('Failed to load groups:', error);
      toast.error(language === 'he' ? 'שגיאה בטעינת קבוצות' : language === 'ar' ? 'خطأ في تحميل المجموعات' : 'Failed to load groups');
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleExtractSelectedGroups = async () => {
    if (!selectedAccountId || selectedGroups.length === 0) {
      toast.warning(
        language === 'he'
          ? 'בחר לפחות קבוצה אחת'
          : language === 'ar'
          ? 'اختر مجموعة واحدة على الأقل'
          : 'Select at least one group'
      );
      return;
    }

    setLoading(true);
    
    try {
      const mergedParticipants = new Map<string, Participant>();
      const failedGroups: string[] = [];

      for (const group of selectedGroups) {
        try {
          const groupParticipants = await api.extractor.getGroupParticipants(selectedAccountId, group.id);

          for (const participant of groupParticipants) {
            const existingParticipant = mergedParticipants.get(participant.phoneNumber);

            if (existingParticipant) {
              existingParticipant.name = existingParticipant.name || participant.name || null;
              existingParticipant.isAdmin = existingParticipant.isAdmin || participant.isAdmin;
              existingParticipant.isSuperAdmin = existingParticipant.isSuperAdmin || participant.isSuperAdmin;
              existingParticipant.sourceGroupIds = Array.from(new Set([...existingParticipant.sourceGroupIds, group.id]));
              existingParticipant.sourceGroupNames = Array.from(new Set([...existingParticipant.sourceGroupNames, group.name]));
            } else {
              mergedParticipants.set(participant.phoneNumber, {
                ...participant,
                sourceGroupIds: [group.id],
                sourceGroupNames: [group.name]
              });
            }
          }
        } catch (error) {
          console.error(`Failed to extract participants from group ${group.name}:`, error);
          failedGroups.push(group.name);
        }
      }

      const participantsData = Array.from(mergedParticipants.values()).sort((a, b) => {
        const firstName = a.name || a.phoneNumber;
        const secondName = b.name || b.phoneNumber;
        return firstName.localeCompare(secondName);
      });

      setParticipants(participantsData);
      setStep('participants');
      
      if (failedGroups.length > 0) {
        toast.warning(
          language === 'he'
            ? `חולצו ${participantsData.length} משתתפים. נכשלו ${failedGroups.length} קבוצות: ${failedGroups.join(', ')}`
            : language === 'ar'
            ? `تم استخراج ${participantsData.length} مشاركين. فشل ${failedGroups.length} مجموعات: ${failedGroups.join('، ')}`
            : `Extracted ${participantsData.length} participants. ${failedGroups.length} groups failed: ${failedGroups.join(', ')}`
        );
      } else {
        toast.success(
          language === 'he' 
            ? `חולצו ${participantsData.length} משתתפים ייחודיים מ-${selectedGroups.length} קבוצות`
            : language === 'ar'
            ? `تم استخراج ${participantsData.length} مشاركين فريدين من ${selectedGroups.length} مجموعات`
            : `Extracted ${participantsData.length} unique participants from ${selectedGroups.length} groups`
        );
      }
    } catch (error) {
      console.error('Failed to get participants:', error);
      toast.error(language === 'he' ? 'שגיאה בחילוץ משתתפים' : language === 'ar' ? 'خطأ في استخراج المشاركين' : 'Failed to extract participants');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (participants.length === 0) return;

    try {
      // Create worksheet data
      const data = participants.map(p => ({
        [language === 'he' ? 'קבוצות מקור' : language === 'ar' ? 'المجموعات المصدر' : 'Source Groups']: p.sourceGroupNames.join(', '),
        [language === 'he' ? 'שם' : language === 'ar' ? 'الاسم' : 'Name']: p.name || '',
        [language === 'he' ? 'מספר טלפון' : language === 'ar' ? 'رقم الهاتف' : 'Phone Number']: p.phoneNumber,
        [language === 'he' ? 'מנהל' : language === 'ar' ? 'مشرف' : 'Admin']: p.isAdmin 
          ? (language === 'he' ? 'כן' : language === 'ar' ? 'نعم' : 'Yes')
          : (language === 'he' ? 'לא' : language === 'ar' ? 'لا' : 'No'),
        [language === 'he' ? 'מנהל על' : language === 'ar' ? 'مشرف أعلى' : 'Super Admin']: p.isSuperAdmin
          ? (language === 'he' ? 'כן' : language === 'ar' ? 'نعم' : 'Yes')
          : (language === 'he' ? 'לא' : language === 'ar' ? 'לא' : 'No')
      }));

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Group Participants');

      // Download file
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `${selectedGroups.length === 1 ? `group_${selectedGroups[0]?.name}` : `groups_${selectedGroups.length}`}_${timestamp}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, '_');
      XLSX.writeFile(wb, fileName);

      toast.success(
        language === 'he'
          ? 'קובץ Excel הורד בהצלחה'
          : language === 'ar'
          ? 'تم تنزيل ملف Excel بنجاح'
          : 'Excel file downloaded successfully'
      );
    } catch (error) {
      console.error('Failed to download Excel:', error);
      toast.error(language === 'he' ? 'שגיאה בהורדת קובץ' : language === 'ar' ? 'خطأ في تنزيل الملف' : 'Failed to download file');
    }
  };

  const handleCreateNewTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      const newTag = await api.tags.create({ 
        name: newTagName.trim(),
        color: newTagColor
      });
      setTags(prev => [...prev, newTag]);
      setSelectedTag(newTag.id);
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setShowNewTagInput(false);
      toast.success(language === 'he' ? 'טאג נוצר' : language === 'ar' ? 'تم إنشاء العلامة' : 'Tag created');
    } catch (error) {
      console.error('Failed to create tag:', error);
      toast.error(language === 'he' ? 'שגיאה ביצירת טאג' : language === 'ar' ? 'خطأ في إنشاء العلامة' : 'Failed to create tag');
    }
  };

  const handleImportToContacts = async () => {
    if (participants.length === 0) return;

    setLoading(true);
    try {
      let count = 0;
      let skipped = 0;

      for (const participant of participants) {
        try {
          const newContact = await api.contacts.create({
            phone_number: participant.phoneNumber,
            name: participant.name || undefined
          });

          // Add tag if selected
          if (selectedTag && newContact?.id) {
            await api.contacts.addTag(newContact.id, selectedTag);
          }

          count++;
        } catch (e: any) {
          // Skip duplicates
          if (e?.message?.includes('UNIQUE constraint') || e?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            skipped++;
            console.log(`Contact ${participant.phoneNumber} already exists - skipping`);
          } else {
            console.error('Failed to create contact:', e);
          }
        }
      }

      let message = '';
      if (language === 'he') {
        message = `${count} אנשי קשר יובאו בהצלחה`;
        if (skipped > 0) message += ` (${skipped} כפולים דולגו)`;
      } else if (language === 'ar') {
        message = `تم استيراد ${count} جهات اتصال بنجاح`;
        if (skipped > 0) message += ` (تم تخطي ${skipped} مكررات)`;
      } else {
        message = `${count} contacts imported successfully`;
        if (skipped > 0) message += ` (${skipped} duplicates skipped)`;
      }

      toast.success(message);
      
      // Reset to start
      setStep('account');
      setSelectedGroupIds([]);
      setParticipants([]);
      setSelectedTag('');
    } catch (error) {
      console.error('Failed to import contacts:', error);
      toast.error(language === 'he' ? 'שגיאה בייבוא' : language === 'ar' ? 'خطأ في الاستيراد' : 'Failed to import');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'participants') {
      setStep('groups');
      setParticipants([]);
    } else if (step === 'groups') {
      setStep('account');
      setGroups([]);
      setSelectedGroupIds([]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            {language === 'he' ? 'חילוץ אנשי קשר מקבוצות' : language === 'ar' ? 'استخراج جهات الاتصال من المجموعات' : 'Extract Contacts from Groups'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'he' 
              ? 'חלץ אנשי קשר מקבוצות WhatsApp בקלות'
              : language === 'ar'
              ? 'استخرج جهات الاتصال من مجموعات WhatsApp بسهولة'
              : 'Extract contacts from WhatsApp groups easily'
            }
          </p>
        </div>
        
        {step !== 'account' && (
          <Button variant="outline" onClick={handleBack} className="gap-2">
            <ArrowRight className="h-4 w-4 rotate-180" />
            {language === 'he' ? 'חזור' : language === 'ar' ? 'رجوع' : 'Back'}
          </Button>
        )}
      </div>

      {/* Step 1: Account Selection */}
      {step === 'account' && (
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">1</div>
              <div>
                <CardTitle>
                  {language === 'he' ? 'בחר חשבון' : language === 'ar' ? 'اختر حساباً' : 'Select Account'}
                </CardTitle>
                <CardDescription>
                  {language === 'he' 
                    ? 'בחר את החשבון שממנו תרצה לחלץ קבוצות'
                    : language === 'ar'
                    ? 'اختر الحساب الذي تريد استخراج المجموعات منه'
                    : 'Choose the account to extract groups from'
                  }
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {accounts.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground">
                  {language === 'he' ? 'אין חשבונות מחוברים' : language === 'ar' ? 'لا توجد حسابات متصلة' : 'No connected accounts'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map(account => (
                  <div
                    key={account.id}
                    onClick={() => setSelectedAccountId(account.id)}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                      selectedAccountId === account.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                        : 'border-border/50 hover:border-primary/30 bg-background/50'
                    }`}
                  >
                    <div className="relative">
                      {account.profile_picture_url ? (
                        <img src={account.profile_picture_url} alt="" className="h-14 w-14 rounded-full object-cover shadow-sm border-2 border-background" />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center border-2 border-background shadow-sm">
                          <Users className="h-7 w-7 text-primary" />
                        </div>
                      )}
                      {selectedAccountId === account.id && (
                        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{account.name || (language === 'he' ? 'ללא שם' : language === 'ar' ? 'بدون اسم' : 'Unnamed')}</p>
                      <p className="text-xs text-muted-foreground truncate font-mono">{account.phone_number}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedAccountId && (
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleLoadGroups} disabled={loadingGroups} className="gap-2">
                  {loadingGroups ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {language === 'he' ? 'טוען...' : language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}
                    </>
                  ) : (
                    <>
                      {language === 'he' ? 'טען קבוצות' : language === 'ar' ? 'تحميل المجموعات' : 'Load Groups'}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Group Selection */}
      {step === 'groups' && (
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
          <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-lg">2</div>
                <div>
                  <CardTitle>
                    {language === 'he' ? 'בחר קבוצות' : language === 'ar' ? 'اختر المجموعات' : 'Select Groups'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'he' 
                      ? `נמצאו ${groups.length} קבוצות • נבחרו ${selectedGroupIds.length}`
                      : language === 'ar'
                      ? `تم العثور على ${groups.length} مجموعات • تم اختيار ${selectedGroupIds.length}`
                      : `Found ${groups.length} groups • selected ${selectedGroupIds.length}`
                    }
                  </CardDescription>
                </div>
              </div>

              <Button onClick={handleExtractSelectedGroups} disabled={loading || selectedGroupIds.length === 0} className="gap-2 self-start">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {language === 'he' ? 'מחלץ...' : language === 'ar' ? 'جارٍ الاستخراج...' : 'Extracting...'}
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4" />
                    {language === 'he'
                      ? `חלץ מ-${selectedGroupIds.length || 0} קבוצות`
                      : language === 'ar'
                      ? `استخراج من ${selectedGroupIds.length || 0} مجموعات`
                      : `Extract from ${selectedGroupIds.length || 0} groups`}
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedGroups.length > 0 && (
              <div className="flex flex-wrap gap-2 rounded-xl border border-purple-100 bg-purple-50/50 p-3 dark:border-purple-900/30 dark:bg-purple-950/10">
                {selectedGroups.map(group => (
                  <Badge key={group.id} variant="secondary" className="gap-1 bg-white/70 dark:bg-card/70">
                    {group.name}
                  </Badge>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto">
              {groups.map(group => (
                <div
                  key={group.id}
                  onClick={() => handleToggleGroup(group.id)}
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all group ${
                    selectedGroupIds.includes(group.id)
                      ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                      : 'border-border/50 hover:border-primary/50 hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-md">
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                      {selectedGroupIds.includes(group.id) && (
                        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                          {group.name}
                        </h3>
                        {group.isAdmin && (
                          <Crown className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>
                          {group.participantCount} {language === 'he' ? 'משתתפים' : language === 'ar' ? 'مشاركين' : 'participants'}
                        </span>
                      </div>
                      {group.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {group.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Participants Display */}
      {step === 'participants' && (
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
          <div className="h-1.5 w-full bg-gradient-to-r from-green-500 to-emerald-500"></div>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 font-bold text-lg">3</div>
                <div>
                  <CardTitle>
                    {selectedGroups.length === 1
                      ? selectedGroups[0]?.name
                      : language === 'he'
                      ? `חילוץ מ-${selectedGroups.length} קבוצות`
                      : language === 'ar'
                      ? `استخراج من ${selectedGroups.length} مجموعات`
                      : `Extraction from ${selectedGroups.length} groups`}
                  </CardTitle>
                  <CardDescription>
                    {participants.length} {language === 'he' ? 'משתתפים ייחודיים' : language === 'ar' ? 'مشاركين فريدين' : 'unique participants'}
                  </CardDescription>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleDownloadExcel} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  {language === 'he' ? 'הורד Excel' : language === 'ar' ? 'تنزيل Excel' : 'Download Excel'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Import Options */}
            <div className="bg-blue-50/50 dark:bg-blue-950/10 p-5 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-4">
              <Label className="text-base font-medium flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                {language === 'he' ? 'ייבא ל-Contacts' : language === 'ar' ? 'استيراد إلى جهات الاتصال' : 'Import to Contacts'}
              </Label>

              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">
                  {language === 'he' ? 'בחר טאג (אופציונלי)' : language === 'ar' ? 'اختر علامة (اختياري)' : 'Select tag (optional)'}
                </Label>

                {!showNewTagInput ? (
                  <div className="flex gap-2">
                    <select
                      value={selectedTag}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setShowNewTagInput(true);
                        } else {
                          setSelectedTag(e.target.value);
                        }
                      }}
                      className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">
                        {language === 'he' ? 'ללא טאג' : language === 'ar' ? 'بدون علامة' : 'No tag'}
                      </option>
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                      <option value="__new__" className="font-semibold">
                        + {language === 'he' ? 'טאג חדש' : language === 'ar' ? 'علامة جديدة' : 'New Tag'}
                      </option>
                    </select>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder={language === 'he' ? 'שם הטאג' : language === 'ar' ? 'اسم العلامة' : 'Tag name'}
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-20"
                    />
                    <Button size="sm" onClick={handleCreateNewTag} disabled={!newTagName.trim()}>
                      {language === 'he' ? 'צור' : language === 'ar' ? 'إنشاء' : 'Create'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setShowNewTagInput(false);
                      setNewTagName('');
                    }}>
                      {language === 'he' ? 'ביטול' : language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </Button>
                  </div>
                )}
              </div>

              <Button 
                onClick={handleImportToContacts} 
                disabled={loading}
                className="w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {language === 'he' ? 'מייבא...' : language === 'ar' ? 'جارٍ الاستيراد...' : 'Importing...'}
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    {language === 'he' ? `ייבא ${participants.length} אנשי קשר` : language === 'ar' ? `استيراد ${participants.length} جهات اتصال` : `Import ${participants.length} Contacts`}
                  </>
                )}
              </Button>
            </div>

            {/* Participants Table */}
            <div className="border rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">
                        {language === 'he' ? 'קבוצות מקור' : language === 'ar' ? 'المجموعات المصدر' : 'Source Groups'}
                      </th>
                      <th className="text-left p-3 text-sm font-medium">
                        {language === 'he' ? 'שם' : language === 'ar' ? 'الاسم' : 'Name'}
                      </th>
                      <th className="text-left p-3 text-sm font-medium">
                        {language === 'he' ? 'מספר טלפון' : language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                      </th>
                      <th className="text-left p-3 text-sm font-medium">
                        {language === 'he' ? 'תפקיד' : language === 'ar' ? 'الدور' : 'Role'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((participant, idx) => (
                      <tr key={idx} className="border-t hover:bg-accent/30 transition-colors">
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                            {participant.sourceGroupNames.map(groupName => (
                              <Badge key={`${participant.phoneNumber}-${groupName}`} variant="outline" className="text-[10px]">
                                {groupName}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                              {(participant.name?.[0] || '#').toUpperCase()}
                            </div>
                            <span className="text-sm font-medium">
                              {participant.name || (language === 'he' ? 'ללא שם' : language === 'ar' ? 'بدون اسم' : 'No name')}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-sm font-mono text-muted-foreground">
                            {participant.phoneNumber}
                          </span>
                        </td>
                        <td className="p-3">
                          {participant.isSuperAdmin ? (
                            <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                              <Crown className="h-3 w-3" />
                              {language === 'he' ? 'מנהל על' : language === 'ar' ? 'مشرف أعلى' : 'Super Admin'}
                            </Badge>
                          ) : participant.isAdmin ? (
                            <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              <Shield className="h-3 w-3" />
                              {language === 'he' ? 'מנהל' : language === 'ar' ? 'مشرف' : 'Admin'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {language === 'he' ? 'משתתף' : language === 'ar' ? 'مشارك' : 'Member'}
                            </span>
                          )}
                        </td>
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
