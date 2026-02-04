import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Send, 
  Image as ImageIcon, 
  Video, 
  FileText, 
  X, 
  CheckSquare,
  Square,
  Upload,
  Smartphone,
  Calendar,
  Clock,
  Zap,
  MoreVertical,
  Phone,
  Video as VideoIcon,
  Wifi,
  Battery,
  Signal,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import type { Account, Tag } from '@/types';
import { cn } from '@/lib/utils';

export default function CreateCampaignPage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document' | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    message: '',
    min_delay: 30,
    max_delay: 60,
    max_messages_per_day: 100,
    start_hour: 9,
    end_hour: 18,
    scheduled_start_datetime: null as string | null,
    enable_scheduling: false
  });

  useEffect(() => {
    loadAccounts();
    loadTags();
  }, []);

  const loadAccounts = async () => {
    const data = await api.accounts.getAll();
    setAccounts(data.filter(acc => acc.status === 'connected'));
  };

  const loadTags = async () => {
    const data = await api.tags.getAll();
    // Filter out BlackList tag - users shouldn't select it for campaigns
    const filteredTags = data.filter(tag => tag.name !== 'BlackList' && !tag.is_system);
    setTags(filteredTags);
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaFile(file);

    // Determine media type
    if (file.type.startsWith('image/')) {
      setMediaType('image');
      const reader = new FileReader();
      reader.onload = (e) => setMediaPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      setMediaType('video');
      const reader = new FileReader();
      reader.onload = (e) => setMediaPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setMediaType('document');
      setMediaPreview(file.name);
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview('');
    setMediaType(null);
  };

  const toggleSelectAllAccounts = () => {
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(accounts.map(acc => acc.id));
    }
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.warning(t('createCampaign.validation.campaignNameRequired'));
      return;
    }
    
    if (!formData.message.trim()) {
      toast.warning(t('createCampaign.validation.messageRequired'));
      return;
    }
    
    if (selectedAccounts.length === 0) {
      toast.warning(t('createCampaign.validation.accountRequired'));
      return;
    }
    
    if (selectedTags.length === 0) {
      toast.warning(t('createCampaign.validation.tagRequired'));
      return;
    }

    setLoading(true);
    try {
      let campaignData: any = { ...formData };
      
      // If scheduling is enabled, convert datetime-local to ISO string
      if (formData.enable_scheduling && formData.scheduled_start_datetime) {
        // Convert from datetime-local format to ISO string
        campaignData.scheduled_start_datetime = new Date(formData.scheduled_start_datetime).toISOString();
      } else {
        campaignData.scheduled_start_datetime = null;
      }
      
      // Remove enable_scheduling from data (not a DB field)
      delete campaignData.enable_scheduling;
      
      // If there's a media file, save it first
      if (mediaFile) {
        console.log('💾 Saving campaign media:', mediaFile.name);
        const arrayBuffer = await mediaFile.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        
        // Save media file and get the path
        const mediaPath = await api.campaigns.saveMedia(mediaFile.name, buffer as any);
        console.log('✅ Media saved to:', mediaPath);
        
        // Add media info to campaign data
        campaignData.media_path = mediaPath;
        campaignData.media_type = mediaType;
        campaignData.media_caption = formData.message; // Use message as caption
      }
      
      const campaign = await api.campaigns.create(campaignData);
      await api.campaigns.addAccounts(campaign.id, selectedAccounts);

      const allContacts = await api.contacts.getAll();
      const filteredContacts = allContacts.filter(contact => 
        contact.tags?.some(tag => selectedTags.includes(tag.id))
      );
      
      if (filteredContacts.length > 0) {
        await api.campaigns.addContacts(
          campaign.id,
          filteredContacts.map(c => ({ phone_number: c.phone_number }))
        );
      }

      toast.success(t('createCampaign.toast.success'));
      navigate('/campaigns');
    } catch (error) {
      console.error('Failed to create campaign:', error);
      toast.error(t('createCampaign.toast.error'));
    } finally {
      setLoading(false);
    }
  };

  // WhatsApp Preview Component
  const WhatsAppPreview = () => {
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    return (
      <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-2xl scale-95 transform transition-transform hover:scale-100 duration-500">
        <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute z-20"></div>
        <div className="h-[32px] w-[3px] bg-gray-800 absolute -start-[17px] top-[72px] rounded-s-lg"></div>
        <div className="h-[46px] w-[3px] bg-gray-800 absolute -start-[17px] top-[124px] rounded-s-lg"></div>
        <div className="h-[46px] w-[3px] bg-gray-800 absolute -start-[17px] top-[178px] rounded-s-lg"></div>
        <div className="h-[64px] w-[3px] bg-gray-800 absolute -end-[17px] top-[142px] rounded-e-lg"></div>
        
        {/* Screen Content */}
        <div className="rounded-[2rem] overflow-hidden w-full h-full bg-[#E5DDD5] dark:bg-[#0b141a] relative flex flex-col">
          {/* Status Bar */}
          <div className="bg-[#008069] dark:bg-[#202c33] px-4 pt-3 pb-2 flex justify-between items-center text-white text-[10px] z-10">
            <span>{currentTime}</span>
            <div className="flex gap-1">
              <Signal className="h-3 w-3" />
              <Wifi className="h-3 w-3" />
              <Battery className="h-3 w-3" />
            </div>
          </div>

          {/* WhatsApp Header */}
          <div className="bg-[#008069] dark:bg-[#202c33] px-3 py-2 flex items-center justify-between text-white shadow-sm z-10">
            <div className="flex items-center gap-2">
              <ArrowLeft className="h-5 w-5 cursor-pointer" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                  <span className="text-gray-600 font-bold text-xs">JD</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm leading-tight">{t('createCampaign.whatsappPreview.contactName')}</span>
                  <span className="text-[10px] opacity-80 leading-tight">{t('createCampaign.whatsappPreview.online')}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <VideoIcon className="h-4 w-4" />
              <Phone className="h-4 w-4" />
              <MoreVertical className="h-4 w-4" />
            </div>
          </div>

          {/* Chat Background & Messages */}
          <div 
            className="flex-1 overflow-y-auto p-4 space-y-4"
            style={{
              backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
              backgroundSize: '400px',
              backgroundBlendMode: 'overlay',
              backgroundColor: '#e5ddd5'
            }}
          >
             {/* Date Divider */}
             <div className="flex justify-center my-2">
                <span className="bg-[#e9edef] dark:bg-[#1f2c34] text-gray-800 dark:text-gray-300 text-[10px] px-2 py-1 rounded-lg shadow-sm font-medium">
                  {t('createCampaign.whatsappPreview.today')}
                </span>
             </div>

             {/* The Message Bubble */}
             <div className="flex justify-end">
                <div className="bg-[#d9fdd3] dark:bg-[#005c4b] rounded-lg rounded-tr-none p-2 max-w-[85%] shadow-sm relative group">
                  {/* Tail */}
                  <div className="absolute top-0 -right-2 w-0 h-0 border-t-[10px] border-t-[#d9fdd3] dark:border-t-[#005c4b] border-r-[10px] border-r-transparent transform rotate-0"></div>
                  
                  {/* Media Preview inside bubble */}
                  {mediaPreview && (
                    <div className="mb-2 rounded-lg overflow-hidden bg-black/10">
                      {mediaType === 'image' && (
                        <img src={mediaPreview} alt="Preview" className="w-full h-auto object-cover" />
                      )}
                      {mediaType === 'video' && (
                        <video src={mediaPreview} className="w-full h-auto" controls />
                      )}
                      {mediaType === 'document' && (
                        <div className="bg-white/50 p-3 flex items-center gap-3 rounded-lg border border-black/5">
                          <FileText className="h-8 w-8 text-red-500" />
                          <span className="text-sm truncate max-w-[120px] font-medium">{mediaFile?.name}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Text */}
                  <p className="text-[13px] text-gray-800 dark:text-gray-100 whitespace-pre-wrap leading-relaxed" dir={language === 'he' || language === 'ar' ? 'rtl' : 'ltr'}>
                    {formData.message || t('createCampaign.whatsappPreview.defaultMessage')}
                  </p>
                  
                  {/* Timestamp & Ticks */}
                  <div className="flex items-end justify-end gap-1 mt-1">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      {currentTime}
                    </span>
                    <span className="text-[#53bdeb]">
                      <svg viewBox="0 0 16 11" height="11" width="16" preserveAspectRatio="xMidYMid meet" className="" version="1.1" x="0px" y="0px" enableBackground="new 0 0 16 11">
                        <path fill="currentColor" d="M12.157,0.492L4.545,8.127L1.875,5.434c-0.345-0.348-0.906-0.348-1.254,0c-0.342,0.345-0.342,0.903,0,1.251 l3.298,3.322c0.165,0.165,0.386,0.258,0.627,0.258c0.235,0,0.456-0.093,0.621-0.258l8.241-8.268c0.345-0.345,0.345-0.903,0-1.248 C13.06,0.146,12.502,0.146,12.157,0.492z M15.385,0.492l-8.244,8.268L6.505,8.127l7.623-7.635c0.346-0.348,0.906-0.348,1.254,0 C15.73,0.837,15.73,1.396,15.385,0.492z M12.791,9.006l-1.304,1.31c-0.345,0.348-0.906,0.348-1.251,0L6.505,6.582 l0.636-0.64l3.111,3.137c0.165,0.168,0.386,0.258,0.624,0.258c0.235,0,0.456-0.09,0.621-0.258l1.293-1.299 C12.791,7.78,12.791,9.006,12.791,9.006z"></path>
                      </svg>
                    </span>
                  </div>
                </div>
             </div>
          </div>
          
          {/* Input Bar Mockup */}
          <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-2 flex items-center gap-2 z-10 border-t border-gray-200 dark:border-gray-800">
            <div className="bg-white dark:bg-[#2a3942] rounded-full p-2 cursor-pointer hover:bg-gray-100 transition-colors">
                <span className="text-gray-500 text-xl">😊</span>
            </div>
            <div className="bg-white dark:bg-[#2a3942] flex-1 rounded-lg px-4 py-2 text-sm text-gray-400 border border-transparent focus:border-[#00a884]">
                {t('createCampaign.whatsappPreview.inputPlaceholder')}
            </div>
            <div className="bg-[#00a884] rounded-full p-2.5 shadow-sm cursor-pointer hover:bg-[#008f6f] transition-colors">
                <span className="text-white text-sm">🎤</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="flex-none px-8 py-6 border-b border-primary/10 bg-card/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/campaigns')}
              className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors h-10 w-10"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {t('createCampaign.title')}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <span className={cn("h-2.5 w-2.5 rounded-full animate-pulse", accounts.length > 0 ? "bg-green-500" : "bg-yellow-500")}></span>
                {t('createCampaign.accountsAvailable').replace('{count}', accounts.length.toString())}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" onClick={() => navigate('/campaigns')} className="border-primary/20 hover:bg-primary/5 hover:text-primary hover:border-primary/50 transition-all">
                {t('createCampaign.buttons.discard')}
             </Button>
             <Button onClick={handleSubmit} disabled={loading} className="gap-2 shadow-lg hover:shadow-primary/30 transition-all bg-gradient-to-r from-primary to-primary/90 hover:scale-[1.02] active:scale-[0.98]">
                <Send className="h-4 w-4" />
                {loading ? t('createCampaign.buttons.launching') : t('createCampaign.buttons.launch')}
             </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            {/* Left Column: Form Configuration */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-8 pb-20">
              
              {/* Step 1: Campaign Details & Message */}
              <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden hover:shadow-2xl transition-all duration-300 group">
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg shadow-sm group-hover:scale-110 transition-transform">1</div>
                    <div>
                      <CardTitle className="text-xl">{t('createCampaign.step1.title')}</CardTitle>
                      <CardDescription>{t('createCampaign.step1.description')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pl-6 pr-6 pb-8">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-base font-medium">{t('createCampaign.step1.campaignName')}</Label>
                    <Input
                      id="name"
                      placeholder={t('createCampaign.step1.campaignNamePlaceholder')}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="text-lg font-medium h-12 border-primary/20 focus:border-primary focus:ring-primary/20 bg-background/50"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="flex justify-between items-center text-base font-medium">
                        {t('createCampaign.step1.messageContent')}
                        <Badge variant="outline" className="text-xs font-normal bg-primary/5 text-primary border-primary/20">
                          {t('createCampaign.step1.personalizeHint')}
                        </Badge>
                    </Label>
                    <div className="relative group/textarea">
                        <Textarea
                        id="message"
                        placeholder={t('createCampaign.step1.messagePlaceholder')}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="min-h-[180px] resize-none pr-12 leading-relaxed text-base border-primary/20 focus:border-primary focus:ring-primary/20 bg-background/50 transition-all"
                        />
                        <div className="absolute bottom-3 right-3 flex gap-2">
                            <input
                                type="file"
                                id="media-upload"
                                className="hidden"
                                accept="image/*,video/*,.pdf,.doc,.docx"
                                onChange={handleMediaUpload}
                            />
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-9 w-9 p-0 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                                onClick={() => document.getElementById('media-upload')?.click()}
                                title={t('createCampaign.attachMedia')}
                            >
                                <Upload className="h-5 w-5 text-muted-foreground group-hover/textarea:text-primary transition-colors" />
                            </Button>
                        </div>
                    </div>
                    {mediaFile && (
                        <div className="flex items-center gap-4 p-4 border border-primary/20 rounded-xl bg-primary/5 animate-in fade-in slide-in-from-bottom-2">
                            <div className="h-12 w-12 rounded-lg bg-background flex items-center justify-center shadow-sm">
                              {mediaType === 'image' ? <ImageIcon className="h-6 w-6 text-blue-500" /> : 
                               mediaType === 'video' ? <Video className="h-6 w-6 text-purple-500" /> : 
                               <FileText className="h-6 w-6 text-orange-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{mediaFile.name}</div>
                              <div className="text-xs text-muted-foreground">{(mediaFile.size / 1024 / 1024).toFixed(2)} MB</div>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={removeMedia} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Step 2: Target Audience */}
              <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden hover:shadow-2xl transition-all duration-300 group">
                <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-lg shadow-sm group-hover:scale-110 transition-transform">2</div>
                    <div>
                      <CardTitle className="text-xl">{t('createCampaign.step2.title')}</CardTitle>
                      <CardDescription>{t('createCampaign.step2.description')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8 pl-6 pr-6 pb-8">
                   {/* Accounts Selection */}
                   <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-base font-medium flex items-center gap-2">
                              <Smartphone className="h-4 w-4 text-primary" />
                              {t('createCampaign.step2.sendFromAccounts')}
                            </Label>
                            <Button variant="ghost" size="sm" onClick={toggleSelectAllAccounts} className="h-8 text-xs gap-2 hover:bg-primary/10 hover:text-primary">
                                {selectedAccounts.length === accounts.length ? <CheckSquare className="h-4 w-4"/> : <Square className="h-4 w-4"/>}
                                {selectedAccounts.length === accounts.length ? t('createCampaign.step2.deselectAll') : t('createCampaign.step2.selectAll')}
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {accounts.map(account => (
                                <div
                                    key={account.id}
                                    onClick={() => toggleAccount(account.id)}
                                    className={cn(
                                        "flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md",
                                        selectedAccounts.includes(account.id) 
                                            ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm" 
                                            : "border-border/50 hover:border-primary/30 bg-background/50"
                                    )}
                                >
                                    <div className="relative">
                                        {account.profile_picture_url ? (
                                            <img src={account.profile_picture_url} alt="" className="h-12 w-12 rounded-full object-cover shadow-sm border-2 border-background" />
                                        ) : (
                                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-background shadow-sm">
                                                <Smartphone className="h-6 w-6 text-primary" />
                                            </div>
                                        )}
                                        {selectedAccounts.includes(account.id) && (
                                            <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-sm animate-in zoom-in">
                                                <CheckSquare className="h-3 w-3" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="font-semibold text-sm truncate">{account.name || t('createCampaign.step2.unnamed')}</p>
                                        <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">{account.phone_number}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                   </div>

                   <Separator className="bg-border/50" />

                   {/* Tags Selection */}
                   <div className="space-y-4">
                        <Label className="text-base font-medium flex items-center gap-2">
                          <Upload className="h-4 w-4 text-primary" />
                          {t('createCampaign.step2.targetAudience')}
                        </Label>
                        <div className="flex flex-wrap gap-3 bg-background/50 p-4 rounded-xl border border-border/50 min-h-[100px]">
                            {tags.length === 0 ? (
                                <div className="w-full flex flex-col items-center justify-center py-4 text-muted-foreground">
                                  <p className="text-sm">{t('createCampaign.step2.noTags')}</p>
                                </div>
                            ) : (
                                tags.map(tag => (
                                    <Badge
                                        key={tag.id}
                                        variant="outline"
                                        className={cn(
                                            "cursor-pointer px-4 py-2 text-sm transition-all select-none border-2 hover:scale-105 active:scale-95",
                                            selectedTags.includes(tag.id) 
                                              ? "bg-primary text-primary-foreground border-primary shadow-md" 
                                              : "bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/30"
                                        )}
                                        onClick={() => toggleTag(tag.id)}
                                        style={selectedTags.includes(tag.id) ? {} : { borderColor: tag.color }}
                                    >
                                        {tag.name}
                                    </Badge>
                                ))
                            )}
                        </div>
                   </div>
                </CardContent>
              </Card>

              {/* Step 3: Schedule & Limits */}
              <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden hover:shadow-2xl transition-all duration-300 group">
                <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 to-yellow-500"></div>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-lg shadow-sm group-hover:scale-110 transition-transform">3</div>
                    <div>
                      <CardTitle className="text-xl">{t('createCampaign.step3.title')}</CardTitle>
                      <CardDescription>{t('createCampaign.step3.description')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8 pl-6 pr-6 pb-8">
                    
                    {/* Delays */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-center bg-background/50 p-3 rounded-lg border border-border/50">
                            <Label className="flex items-center gap-2 text-base font-medium">
                                <Clock className="h-5 w-5 text-orange-500" /> {t('createCampaign.step3.delayBetweenMessages')}
                            </Label>
                            <Badge variant="secondary" className="text-sm font-mono px-3">
                                {formData.min_delay}s - {formData.max_delay}s
                            </Badge>
                        </div>
                        <div className="px-2">
                             <div className="flex items-center gap-6">
                                <div className="flex-1 space-y-3">
                                    <div className="flex justify-between text-sm font-medium text-muted-foreground">
                                        <span>{t('createCampaign.step3.minDelay')}</span>
                                    </div>
                                    <Input 
                                        type="number" 
                                        value={formData.min_delay}
                                        onChange={e => setFormData({...formData, min_delay: +e.target.value})}
                                        className="h-12 text-center font-mono text-lg border-orange-200 focus:border-orange-500 focus:ring-orange-200"
                                    />
                                </div>
                                <div className="w-8 h-[2px] bg-border mt-8"></div>
                                <div className="flex-1 space-y-3">
                                    <div className="flex justify-between text-sm font-medium text-muted-foreground">
                                        <span>{t('createCampaign.step3.maxDelay')}</span>
                                    </div>
                                    <Input 
                                        type="number" 
                                        value={formData.max_delay}
                                        onChange={e => setFormData({...formData, max_delay: +e.target.value})}
                                        className="h-12 text-center font-mono text-lg border-orange-200 focus:border-orange-500 focus:ring-orange-200"
                                    />
                                </div>
                             </div>
                        </div>
                    </div>

                    <Separator className="bg-border/50" />

                    {/* Limits & Hours */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <Label className="flex items-center gap-2 text-base font-medium">
                                <Zap className="h-5 w-5 text-yellow-500" /> {t('createCampaign.step3.dailyLimit')}
                            </Label>
                            <div className="flex items-center gap-3 bg-background/50 p-4 rounded-xl border border-border/50">
                                <Input 
                                    type="number" 
                                    value={formData.max_messages_per_day}
                                    onChange={e => setFormData({...formData, max_messages_per_day: +e.target.value})}
                                    className="h-12 text-lg font-mono w-24 text-center border-yellow-200 focus:border-yellow-500 focus:ring-yellow-200"
                                />
                                <span className="text-sm font-medium text-muted-foreground">{t('createCampaign.step3.msgsPerAccount')}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2 text-base font-medium">
                                    <Calendar className="h-5 w-5 text-blue-500" /> {t('createCampaign.step3.workingHours')}
                                </Label>
                                <Button 
                                    type="button" 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setFormData({...formData, start_hour: 0, end_hour: 24})}
                                    className="h-8 text-xs hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors"
                                >
                                    <Clock className="h-3 w-3 mr-1.5" />
                                    {t('createCampaign.step3.set24_7')}
                                </Button>
                            </div>
                            
                            <div className="flex items-center gap-3 bg-background/50 p-4 rounded-xl border border-border/50">
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground mb-1 text-center">{t('createCampaign.step3.startTime')}</p>
                                    <Input 
                                        type="number" 
                                        min={0} 
                                        max={23}
                                        value={formData.start_hour}
                                        onChange={e => setFormData({...formData, start_hour: +e.target.value})}
                                        className="text-center font-mono text-lg h-12 border-blue-200 focus:border-blue-500 focus:ring-blue-200"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1 text-center font-mono bg-muted/50 rounded px-1">
                                        {String(formData.start_hour).padStart(2, '0')}:00
                                    </p>
                                </div>
                                <span className="text-muted-foreground font-bold">-</span>
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground mb-1 text-center">{t('createCampaign.step3.endTime')}</p>
                                    <Input 
                                        type="number" 
                                        min={0} 
                                        max={24}
                                        value={formData.end_hour}
                                        onChange={e => setFormData({...formData, end_hour: +e.target.value})}
                                        className="text-center font-mono text-lg h-12 border-blue-200 focus:border-blue-500 focus:ring-blue-200"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1 text-center font-mono bg-muted/50 rounded px-1">
                                        {String(formData.end_hour).padStart(2, '0')}:00
                                    </p>
                                </div>
                            </div>
                            
                            {/* Visual indicator for 24/7 mode */}
                            {formData.start_hour === 0 && formData.end_hour === 24 && (
                                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-2.5 animate-in fade-in slide-in-from-top-2">
                                    <p className="text-xs text-green-800 dark:text-green-200 font-medium flex items-center justify-center gap-1.5">
                                        <CheckSquare className="h-3.5 w-3.5" />
                                        {t('createCampaign.step3.alwaysOn')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator className="bg-border/50" />

                    {/* Campaign Scheduling */}
                    <div className="space-y-4 bg-blue-50/50 dark:bg-blue-950/10 p-5 rounded-xl border border-blue-100 dark:border-blue-900/30">
                        <div className="flex items-center gap-3">
                            <Switch
                                id="enable_scheduling"
                                checked={formData.enable_scheduling}
                                onCheckedChange={checked => setFormData({...formData, enable_scheduling: checked})}
                                className="data-[state=checked]:bg-blue-600"
                            />
                            <Label htmlFor="enable_scheduling" className="cursor-pointer flex items-center gap-2 font-medium text-base">
                                <Calendar className="h-5 w-5 text-blue-600" />
                                {t('createCampaign.scheduling.enableScheduling')}
                            </Label>
                        </div>
                        
                        {formData.enable_scheduling && (
                            <div className="pl-14 animate-in fade-in slide-in-from-top-2">
                                <div className="max-w-sm space-y-2">
                                    <Label className="text-sm text-muted-foreground">
                                        {t('createCampaign.scheduling.startDateTime')}
                                    </Label>
                                    <Input 
                                        type="datetime-local"
                                        value={formData.scheduled_start_datetime || ''}
                                        onChange={e => setFormData({...formData, scheduled_start_datetime: e.target.value})}
                                        min={new Date().toISOString().slice(0, 16)}
                                        className="font-mono h-12 text-lg border-blue-200 focus:border-blue-500 focus:ring-blue-200 bg-background"
                                    />
                                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1.5">
                                        <Info className="h-3.5 w-3.5" />
                                        {language === 'he' 
                                            ? 'הקמפיין יתחיל אוטומטית בתאריך ושעה שנבחרו'
                                            : language === 'ar'
                                            ? 'ستبدأ الحملة تلقائياً في التاريخ والوقت المحددين'
                                            : 'Campaign will start automatically at the selected date and time'
                                        }
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
              </Card>

            </div>

            {/* Right Column: Preview (Sticky) */}
            <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
              <div className="sticky top-24 space-y-8">
                <div className="flex items-center justify-between px-2">
                    <h3 className="font-bold text-xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">{t('createCampaign.preview.title')}</h3>
                    <Badge variant="outline" className="bg-background/50 backdrop-blur border-primary/20 text-primary">{t('createCampaign.preview.whatsappWeb')}</Badge>
                </div>
                
                <div className="flex justify-center transform hover:scale-[1.02] transition-transform duration-500">
                    <WhatsAppPreview />
                </div>

                {/* Summary Card below phone */}
                <Card className="border-none shadow-xl bg-card/80 backdrop-blur overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-primary via-blue-500 to-purple-500"></div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{t('createCampaign.summary.title')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                                <p className="text-xs text-muted-foreground mb-1">{t('createCampaign.summary.selectedAccounts')}</p>
                                <p className="text-2xl font-bold text-primary">{selectedAccounts.length}</p>
                            </div>
                            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                                <p className="text-xs text-muted-foreground mb-1">{t('createCampaign.summary.targetTags')}</p>
                                <p className="text-2xl font-bold text-purple-600">{selectedTags.length}</p>
                            </div>
                        </div>
                        
                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-muted-foreground">{t('createCampaign.summary.estDailyVolume')}</span>
                                <Zap className="h-4 w-4 text-yellow-500" />
                            </div>
                            <p className="text-3xl font-bold text-primary">
                                {t('createCampaign.summary.msgsCount').replace('{count}', (selectedAccounts.length * formData.max_messages_per_day).toString())}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 opacity-70">Based on limits and accounts</p>
                        </div>
                    </CardContent>
                </Card>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
