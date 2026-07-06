import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Info, RefreshCcw, Users, UserPlus, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import type { Account, Contact, Tag, WhatsAppGroupSummary } from '@/types';

function dedupeContactsByPhone(contacts: Contact[]): Array<{ phone_number: string }> {
  const seen = new Set<string>();

  return contacts.reduce<Array<{ phone_number: string }>>((result, contact) => {
    const phoneNumber = contact.phone_number?.trim();
    if (!phoneNumber || seen.has(phoneNumber)) {
      return result;
    }

    seen.add(phoneNumber);
    result.push({ phone_number: phoneNumber });
    return result;
  }, []);
}

export default function CreateGroupAdderCampaignPage() {
  const navigate = useNavigate();
  const { id: campaignId } = useParams<{ id: string }>();
  const isEditMode = Boolean(campaignId);
  const { language } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<WhatsAppGroupSummary[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [groupSourceAccountId, setGroupSourceAccountId] = useState('');
  const [targetGroupId, setTargetGroupId] = useState('');
  const [targetGroupName, setTargetGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCampaign, setLoadingCampaign] = useState(isEditMode);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [existingContactsCount, setExistingContactsCount] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    min_delay: 45,
    max_delay: 90,
    max_messages_per_day: 40,
    start_hour: 9,
    end_hour: 18,
    scheduled_start_datetime: null as string | null,
    enable_scheduling: false,
    messages_before_break: null as number | null,
    break_duration: null as number | null,
    enable_breaks: false,
  });

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!groupSourceAccountId) {
      setGroups([]);
      return;
    }

    void loadGroups(groupSourceAccountId);
  }, [groupSourceAccountId]);

  const audienceContacts = useMemo(() => {
    const filteredContacts = contacts.filter(contact =>
      contact.tags?.some(tag => selectedTags.includes(tag.id))
    );

    return dedupeContactsByPhone(filteredContacts);
  }, [contacts, selectedTags]);

  const selectedGroup = useMemo(() => {
    return groups.find(group => group.id === targetGroupId) || (targetGroupId
      ? {
          id: targetGroupId,
          name: targetGroupName || targetGroupId,
          participantCount: 0,
          description: '',
          isAdmin: false,
        }
      : null);
  }, [groups, targetGroupId, targetGroupName]);

  async function loadInitialData() {
    try {
      const [accountsData, tagsData, contactsData] = await Promise.all([
        api.accounts.getAll(),
        api.tags.getAll(),
        api.contacts.getAll(),
      ]);

      setAccounts(accountsData);
      setTags(tagsData);
      setContacts(contactsData);

      if (isEditMode && campaignId) {
        await loadCampaign(campaignId);
      }
    } catch (error) {
      console.error('Failed to load group adder form data:', error);
      toast.error(language === 'he' ? 'שגיאה בטעינת הנתונים' : language === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data');
      if (isEditMode) {
        navigate('/campaigns');
      }
    } finally {
      setLoadingCampaign(false);
    }
  }

  async function loadCampaign(id: string) {
    const campaign = await api.campaigns.getById(id);

    if (!campaign) {
      toast.error(language === 'he' ? 'קמפיין לא נמצא' : language === 'ar' ? 'الحملة غير موجودة' : 'Campaign not found');
      navigate('/campaigns');
      return;
    }

    if ((campaign.campaign_type || 'message') !== 'group_adder') {
      navigate(`/campaigns/edit/${id}`);
      return;
    }

    if (!['draft', 'paused', 'stopped'].includes(campaign.status)) {
      toast.error(language === 'he' ? 'לא ניתן לערוך קמפיין זה' : language === 'ar' ? 'لا يمكن تعديل هذه الحملة' : 'Cannot edit this campaign');
      navigate('/campaigns');
      return;
    }

    setFormData({
      name: campaign.name,
      min_delay: campaign.min_delay || 45,
      max_delay: campaign.max_delay || 90,
      max_messages_per_day: campaign.max_messages_per_day || 40,
      start_hour: campaign.start_hour || 9,
      end_hour: campaign.end_hour || 18,
      scheduled_start_datetime: campaign.scheduled_start_datetime ? new Date(campaign.scheduled_start_datetime).toISOString().slice(0, 16) : null,
      enable_scheduling: Boolean(campaign.scheduled_start_datetime),
      messages_before_break: campaign.messages_before_break || null,
      break_duration: campaign.break_duration || null,
      enable_breaks: Boolean(campaign.messages_before_break && campaign.break_duration),
    });

    setSelectedTags(campaign.source_tag_ids || []);
    setGroupSourceAccountId(campaign.group_source_account_id || '');
    setTargetGroupId(campaign.target_group_id || '');
    setTargetGroupName(campaign.target_group_name || '');
    setSelectedAccounts(await api.campaigns.getAccounts(id));
    setExistingContactsCount((await api.campaigns.getContacts(id)).length);
  }

  async function loadGroups(accountId: string) {
    setLoadingGroups(true);

    try {
      const groupsData = await api.groups.getGroups(accountId);
      setGroups(groupsData);

      if (targetGroupId) {
        const matchingGroup = groupsData.find(group => group.id === targetGroupId);
        if (matchingGroup) {
          setTargetGroupName(matchingGroup.name);
        }
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
      setGroups([]);
      toast.error(language === 'he' ? 'שגיאה בטעינת הקבוצות' : language === 'ar' ? 'فشل تحميل المجموعات' : 'Failed to load groups');
    } finally {
      setLoadingGroups(false);
    }
  }

  function toggleAccount(accountId: string) {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  }

  function toggleTag(tagId: string) {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!formData.name.trim()) {
      toast.warning(language === 'he' ? 'יש להזין שם לקמפיין' : language === 'ar' ? 'يرجى إدخال اسم للحملة' : 'Please enter a campaign name');
      return;
    }

    if (!groupSourceAccountId) {
      toast.warning(language === 'he' ? 'יש לבחור חשבון מקור לקבוצה' : language === 'ar' ? 'يرجى اختيار حساب مصدر للمجموعة' : 'Please choose a source account for the group');
      return;
    }

    if (!targetGroupId) {
      toast.warning(language === 'he' ? 'יש לבחור קבוצה יעד' : language === 'ar' ? 'يرجى اختيار المجموعة المستهدفة' : 'Please choose a target group');
      return;
    }

    if (selectedAccounts.length === 0) {
      toast.warning(language === 'he' ? 'יש לבחור לפחות חשבון אחד' : language === 'ar' ? 'يرجى اختيار حساب واحد على الأقل' : 'Please choose at least one account');
      return;
    }

    if (selectedTags.length === 0) {
      toast.warning(language === 'he' ? 'יש לבחור לפחות תגית אחת' : language === 'ar' ? 'يرجى اختيار وسم واحد على الأقل' : 'Please choose at least one tag');
      return;
    }

    if (audienceContacts.length === 0) {
      toast.warning(language === 'he' ? 'לא נמצאו אנשי קשר עם התגיות שנבחרו' : language === 'ar' ? 'لم يتم العثور على جهات اتصال بالوسوم المحددة' : 'No contacts were found for the selected tags');
      return;
    }

    const selectedGroupSummary = groups.find(group => group.id === targetGroupId);

    setLoading(true);
    try {
      const campaignData = {
        name: formData.name.trim(),
        message: '',
        campaign_type: 'group_adder' as const,
        min_delay: formData.min_delay,
        max_delay: formData.max_delay,
        max_messages_per_day: formData.max_messages_per_day,
        start_hour: formData.start_hour,
        end_hour: formData.end_hour,
        scheduled_start_datetime: formData.enable_scheduling && formData.scheduled_start_datetime
          ? new Date(formData.scheduled_start_datetime).toISOString()
          : null,
        messages_before_break: formData.enable_breaks ? formData.messages_before_break : null,
        break_duration: formData.enable_breaks ? formData.break_duration : null,
        skip_recent_contacts: 0 as unknown as boolean,
        skip_recent_days: 7,
        target_group_id: targetGroupId,
        target_group_name: selectedGroupSummary?.name || targetGroupName || targetGroupId,
        group_source_account_id: groupSourceAccountId,
        source_tag_ids: selectedTags,
      };

      if (isEditMode && campaignId) {
        await api.campaigns.update(campaignId, campaignData);
        await api.campaigns.setAccounts(campaignId, selectedAccounts);
        await api.campaigns.setContacts(campaignId, audienceContacts);
        toast.success(language === 'he' ? 'קמפיין Group Adder עודכן בהצלחה' : language === 'ar' ? 'تم تحديث حملة إضافة المجموعة بنجاح' : 'Group adder campaign updated successfully');
      } else {
        const campaign = await api.campaigns.create(campaignData);
        await api.campaigns.setAccounts(campaign.id, selectedAccounts);
        await api.campaigns.setContacts(campaign.id, audienceContacts);
        toast.success(language === 'he' ? 'קמפיין Group Adder נוצר בהצלחה' : language === 'ar' ? 'تم إنشاء حملة إضافة المجموعة بنجاح' : 'Group adder campaign created successfully');
      }

      navigate('/campaigns');
    } catch (error) {
      console.error('Failed to save group adder campaign:', error);
      toast.error(language === 'he' ? 'שגיאה בשמירת הקמפיין' : language === 'ar' ? 'فشل حفظ الحملة' : 'Failed to save campaign');
    } finally {
      setLoading(false);
    }
  }

  if (loadingCampaign) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isEditMode
              ? language === 'he'
                ? 'עריכת Group Adder Campaign'
                : language === 'ar'
                ? 'تعديل حملة إضافة المجموعة'
                : 'Edit Group Adder Campaign'
              : language === 'he'
              ? 'יצירת Group Adder Campaign'
              : language === 'ar'
              ? 'إنشاء حملة إضافة إلى مجموعة'
              : 'Create Group Adder Campaign'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'he'
              ? 'בחר קבוצה, תגיות וחשבונות שיחלקו את הוספת המשתתפים.'
              : language === 'ar'
              ? 'اختر المجموعة والوسوم والحسابات التي ستوزع إضافة المشاركين.'
              : 'Choose the group, tags, and accounts that will distribute participant adds.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/campaigns/create')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === 'he' ? 'חזרה' : language === 'ar' ? 'رجوع' : 'Back'}
          </Button>
          {groupSourceAccountId && (
            <Button type="button" variant="outline" onClick={() => void loadGroups(groupSourceAccountId)} disabled={loadingGroups}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loadingGroups ? 'animate-spin' : ''}`} />
              {language === 'he' ? 'רענן קבוצות' : language === 'ar' ? 'تحديث المجموعات' : 'Refresh groups'}
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{language === 'he' ? 'פרטי הקמפיין' : language === 'ar' ? 'تفاصيل الحملة' : 'Campaign details'}</CardTitle>
              <CardDescription>
                {language === 'he'
                  ? 'הגדר את שם הקמפיין ואת קצב העבודה.'
                  : language === 'ar'
                  ? 'حدد اسم الحملة وسرعة التنفيذ.'
                  : 'Set the campaign name and processing pace.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">{language === 'he' ? 'שם הקמפיין' : language === 'ar' ? 'اسم الحملة' : 'Campaign name'}</Label>
                <Input
                  id="campaign-name"
                  value={formData.name}
                  onChange={(event) => setFormData(prev => ({ ...prev, name: event.target.value }))}
                  placeholder={language === 'he' ? 'לדוגמה: Leads to VIP Group' : language === 'ar' ? 'مثال: العملاء إلى مجموعة VIP' : 'For example: Leads to VIP Group'}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{language === 'he' ? 'מינימום השהיה (שניות)' : language === 'ar' ? 'أقل تأخير (ثانية)' : 'Minimum delay (seconds)'}</Label>
                  <Input type="number" min={5} value={formData.min_delay} onChange={(event) => setFormData(prev => ({ ...prev, min_delay: Number(event.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'he' ? 'מקסימום השהיה (שניות)' : language === 'ar' ? 'أقصى تأخير (ثانية)' : 'Maximum delay (seconds)'}</Label>
                  <Input type="number" min={5} value={formData.max_delay} onChange={(event) => setFormData(prev => ({ ...prev, max_delay: Number(event.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'he' ? 'מקסימום הוספות ליום לחשבון' : language === 'ar' ? 'أقصى إضافات يومية لكل حساب' : 'Max daily adds per account'}</Label>
                  <Input type="number" min={1} value={formData.max_messages_per_day} onChange={(event) => setFormData(prev => ({ ...prev, max_messages_per_day: Number(event.target.value) }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{language === 'he' ? 'שעת התחלה' : language === 'ar' ? 'ساعة البدء' : 'Start hour'}</Label>
                  <Input type="number" min={0} max={23} value={formData.start_hour} onChange={(event) => setFormData(prev => ({ ...prev, start_hour: Number(event.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'he' ? 'שעת סיום' : language === 'ar' ? 'ساعة الانتهاء' : 'End hour'}</Label>
                  <Input type="number" min={1} max={24} value={formData.end_hour} onChange={(event) => setFormData(prev => ({ ...prev, end_hour: Number(event.target.value) }))} />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id="enable_scheduling"
                    checked={formData.enable_scheduling}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enable_scheduling: checked }))}
                  />
                  <Label htmlFor="enable_scheduling" className="cursor-pointer flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {language === 'he' ? 'הפעל תזמון התחלה' : language === 'ar' ? 'تفعيل جدولة البدء' : 'Enable scheduled start'}
                  </Label>
                </div>
                {formData.enable_scheduling && (
                  <Input
                    type="datetime-local"
                    value={formData.scheduled_start_datetime || ''}
                    onChange={(event) => setFormData(prev => ({ ...prev, scheduled_start_datetime: event.target.value || null }))}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id="enable_breaks"
                    checked={formData.enable_breaks}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enable_breaks: checked }))}
                  />
                  <Label htmlFor="enable_breaks" className="cursor-pointer flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {language === 'he' ? 'הפעל הפסקות אוטומטיות' : language === 'ar' ? 'تفعيل فترات الراحة التلقائية' : 'Enable automatic breaks'}
                  </Label>
                </div>
                {formData.enable_breaks && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{language === 'he' ? 'מספר הוספות לפני הפסקה' : language === 'ar' ? 'عدد الإضافات قبل الاستراحة' : 'Adds before break'}</Label>
                      <Input type="number" min={1} value={formData.messages_before_break || ''} onChange={(event) => setFormData(prev => ({ ...prev, messages_before_break: event.target.value ? Number(event.target.value) : null }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === 'he' ? 'משך הפסקה בדקות' : language === 'ar' ? 'مدة الاستراحة بالدقائق' : 'Break duration in minutes'}</Label>
                      <Input type="number" min={1} value={formData.break_duration || ''} onChange={(event) => setFormData(prev => ({ ...prev, break_duration: event.target.value ? Number(event.target.value) : null }))} />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{language === 'he' ? 'בחירת קבוצה וחשבונות' : language === 'ar' ? 'اختيار المجموعة والحسابات' : 'Group and account selection'}</CardTitle>
              <CardDescription>
                {language === 'he'
                  ? 'בחר חשבון שממנו טוענים את הקבוצות ואת כל החשבונות שישתתפו בהוספות.'
                  : language === 'ar'
                  ? 'اختر الحساب الذي سيتم تحميل المجموعات منه وكل الحسابات المشاركة في الإضافات.'
                  : 'Choose the account used to load groups and all accounts that should participate in adds.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>{language === 'he' ? 'חשבון מקור לקבוצה' : language === 'ar' ? 'حساب مصدر المجموعة' : 'Group source account'}</Label>
                <select
                  value={groupSourceAccountId}
                  onChange={(event) => {
                    setGroupSourceAccountId(event.target.value);
                    setTargetGroupId('');
                    setTargetGroupName('');
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">{language === 'he' ? 'בחר חשבון' : language === 'ar' ? 'اختر حسابًا' : 'Choose account'}</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {(account.name || account.phone_number) + ` • ${account.status}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>{language === 'he' ? 'קבוצת יעד' : language === 'ar' ? 'المجموعة المستهدفة' : 'Target group'}</Label>
                <select
                  value={targetGroupId}
                  onChange={(event) => {
                    const nextGroupId = event.target.value;
                    const nextGroup = groups.find(group => group.id === nextGroupId);
                    setTargetGroupId(nextGroupId);
                    setTargetGroupName(nextGroup?.name || '');
                  }}
                  disabled={!groupSourceAccountId || loadingGroups}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">{loadingGroups ? (language === 'he' ? 'טוען קבוצות...' : language === 'ar' ? 'جارٍ تحميل المجموعات...' : 'Loading groups...') : (language === 'he' ? 'בחר קבוצה' : language === 'ar' ? 'اختر مجموعة' : 'Choose group')}</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {`${group.name} • ${group.participantCount}`}
                    </option>
                  ))}
                </select>
              </div>

              {selectedGroup && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-medium">{selectedGroup.name}</span>
                    <Badge variant={selectedGroup.isAdmin ? 'default' : 'secondary'}>
                      {selectedGroup.isAdmin
                        ? (language === 'he' ? 'אדמין' : language === 'ar' ? 'مشرف' : 'Admin')
                        : (language === 'he' ? 'ללא אדמין' : language === 'ar' ? 'بدون صلاحية مشرف' : 'No admin access')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {language === 'he'
                      ? `כמות משתתפים נוכחית: ${selectedGroup.participantCount}`
                      : language === 'ar'
                      ? `عدد المشاركين الحالي: ${selectedGroup.participantCount}`
                      : `Current participants: ${selectedGroup.participantCount}`}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Label>{language === 'he' ? 'חשבונות משתתפים' : language === 'ar' ? 'الحسابات المشاركة' : 'Participating accounts'}</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  {accounts.map(account => {
                    const isSelected = selectedAccounts.includes(account.id);
                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => toggleAccount(account.id)}
                        className={`rounded-lg border p-4 text-left transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-medium">{account.name || account.phone_number}</div>
                            <div className="text-xs text-muted-foreground">{account.phone_number}</div>
                          </div>
                          <Badge variant={account.status === 'connected' ? 'default' : 'secondary'}>
                            {account.status}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" />
                  {language === 'he'
                    ? 'בעת התחלת הקמפיין המערכת תוודא מחדש אילו חשבונות מחוברים ומנהלים בקבוצה.'
                    : language === 'ar'
                    ? 'عند بدء الحملة سيعاد التحقق من الحسابات المتصلة والتي تملك صلاحية المشرف في المجموعة.'
                    : 'When the campaign starts, connected accounts with admin access in the group will be revalidated.'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{language === 'he' ? 'בחירת קהל לפי תגיות' : language === 'ar' ? 'اختيار الجمهور حسب الوسوم' : 'Audience by tags'}</CardTitle>
              <CardDescription>
                {language === 'he'
                  ? 'בחר תגיות והמערכת תבנה אוטומטית את רשימת אנשי הקשר להוספה.'
                  : language === 'ar'
                  ? 'اختر الوسوم وسيتم بناء قائمة جهات الاتصال للإضافة تلقائيًا.'
                  : 'Choose tags and the system will build the contact audience automatically.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => {
                  const isSelected = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40'}`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">{language === 'he' ? 'תגיות שנבחרו' : language === 'ar' ? 'الوسوم المحددة' : 'Selected tags'}</div>
                  <div className="text-2xl font-semibold">{selectedTags.length}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{language === 'he' ? 'קהל ייחודי' : language === 'ar' ? 'جمهور فريد' : 'Unique audience'}</div>
                  <div className="text-2xl font-semibold">{audienceContacts.length}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{language === 'he' ? 'בקמפיין קיים' : language === 'ar' ? 'في الحملة الحالية' : 'Existing campaign contacts'}</div>
                  <div className="text-2xl font-semibold">{existingContactsCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{language === 'he' ? 'סיכום' : language === 'ar' ? 'الملخص' : 'Summary'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserPlus className="h-4 w-4" />
                    {language === 'he' ? 'קבוצת יעד' : language === 'ar' ? 'المجموعة المستهدفة' : 'Target group'}
                  </div>
                  <div className="mt-2 font-semibold">{selectedGroup?.name || (language === 'he' ? 'לא נבחרה קבוצה' : language === 'ar' ? 'لم يتم اختيار مجموعة' : 'No group selected')}</div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {language === 'he' ? 'אנשי קשר להוספה' : language === 'ar' ? 'جهات الاتصال للإضافة' : 'Contacts to add'}
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{audienceContacts.length}</div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Smartphone className="h-4 w-4" />
                    {language === 'he' ? 'חשבונות פעילים' : language === 'ar' ? 'الحسابات النشطة' : 'Selected accounts'}
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{selectedAccounts.length}</div>
                </div>
              </div>

              <div className="rounded-lg border bg-amber-50/60 p-4 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
                {language === 'he'
                  ? 'המערכת תעבוד לפי קצב, שעות עבודה והפסקות. הצלחה יכולה להיות הוספה ישירה או שליחת הזמנה פרטית בהתאם להרשאות של איש הקשר.'
                  : language === 'ar'
                  ? 'سيعمل النظام حسب السرعة وساعات العمل وفترات الراحة. يمكن أن تكون النتيجة إضافة مباشرة أو إرسال دعوة خاصة حسب إعدادات جهة الاتصال.'
                  : 'The system will follow your pacing, working hours, and breaks. Success can be either a direct add or a private invite depending on the contact privacy settings.'}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? (language === 'he' ? 'שומר...' : language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...')
                  : isEditMode
                  ? (language === 'he' ? 'שמור שינויים' : language === 'ar' ? 'حفظ التغييرات' : 'Save changes')
                  : (language === 'he' ? 'צור קמפיין' : language === 'ar' ? 'إنشاء الحملة' : 'Create campaign')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
