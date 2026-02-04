import { useEffect, useState } from 'react';
import { Plus, Upload, Download, FileDown, Search, Filter, Tags, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import ContactsTable from '@/components/contacts/ContactsTable';
import ImportContacts from '@/components/contacts/ImportContacts';
import TagManager from '@/components/contacts/TagManager';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import type { Contact, Tag } from '@/types';

export default function Contacts() {
  const { t, language } = useLanguage();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    contactId: string | null;
  }>({ open: false, contactId: null });

  useEffect(() => {
    loadContacts();
    loadTags();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [contacts, selectedTag, searchQuery]);

  const loadContacts = async () => {
    try {
      const data = await api.contacts.getAll();
      setContacts(data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const data = await api.tags.getAll();
      setTags(data);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const filterContacts = () => {
    let filtered = contacts;

    // Filter by tag
    if (selectedTag !== 'all') {
      filtered = filtered.filter(contact =>
        contact.tags?.some(tag => tag.id === selectedTag)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(contact =>
        contact.phone_number.toLowerCase().includes(query) ||
        contact.name?.toLowerCase().includes(query)
      );
    }

    setFilteredContacts(filtered);
  };

  const handleDeleteClick = (id: string) => {
    setConfirmDialog({ open: true, contactId: id });
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDialog.contactId) return;

    try {
      await api.contacts.delete(confirmDialog.contactId);
      setContacts(prev => prev.filter(c => c.id !== confirmDialog.contactId));
      toast.success(t('toast.contactDeleted'));
    } catch (error) {
      console.error('Failed to delete contact:', error);
      toast.error(t('toast.error'));
    } finally {
      // Ensure dialog state is cleared
      setConfirmDialog({ open: false, contactId: null });
    }
  };

  const handleManageTags = (contact: Contact) => {
    setSelectedContact(contact);
    setShowTagManager(true);
  };

  const handleExport = async () => {
    if (contacts.length === 0) {
      toast.warning(t('contacts.noContacts'));
      return;
    }

    // Prepare data for export
    const exportData = contacts.map(contact => ({
      phone_number: contact.phone_number,
      name: contact.name || '',
      tags: contact.tags?.map(t => t.name).join(', ') || ''
    }));

    // Create CSV content
    const headers = ['phone_number', 'name', 'tags'];
    const csvRows = [
      headers.join(','),
      ...exportData.map(row => 
        [row.phone_number, row.name, row.tags].map(val => 
          val.includes(',') ? `"${val}"` : val
        ).join(',')
      )
    ];
    const csvContent = csvRows.join('\n');
    
    // Add UTF-8 BOM for proper Hebrew/Arabic support in Excel
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;
    
    // Create and download file
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    
    link.setAttribute('href', url);
    link.setAttribute('download', `contacts_export_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(t('toast.success'));
  };

  const handleDownloadSample = () => {
    // Create sample CSV content with UTF-8 support
    const headers = ['phone_number', 'name', 'tags'];
    const sampleData = language === 'he' 
      ? [
          ['972501234567', 'ישראל ישראלי', 'vip, לקוח_חדש'],
          ['972521234567', 'שרה כהן', 'לקוח']
        ]
      : language === 'ar'
      ? [
          ['966501234567', 'أحمد محمد', 'vip, عميل_جديد'],
          ['966521234567', 'فاطمة علي', 'عميل']
        ]
      : [
          ['972501234567', 'John Doe', 'vip, new_lead'],
          ['15551234567', 'Jane Smith', 'customer']
        ];
    
    const csvRows = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ];
    const csvContent = csvRows.join('\n');
    
    // Add UTF-8 BOM for proper encoding
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;
    
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'contacts_sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            {t('contacts.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('contacts.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="shadow-sm">
            <Download className="h-4 w-4 mr-2" />
            {t('common.export')}
          </Button>
          <Button onClick={() => setShowImportDialog(true)} className="shadow-md hover:shadow-lg transition-all">
            <Upload className="h-4 w-4 mr-2" />
            {t('contacts.importContacts')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{language === 'he' ? 'סה"כ אנשי קשר' : language === 'ar' ? 'إجمالي جهات الاتصال' : 'Total Contacts'}</p>
              <h3 className="text-2xl font-bold mt-1">{contacts.length}</h3>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('contacts.tags')}</p>
              <h3 className="text-2xl font-bold mt-1">{tags.length}</h3>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
              <Tags className="h-5 w-5 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">BlackList</p>
              <h3 className="text-2xl font-bold mt-1 text-red-600">
                {contacts.filter(c => c.tags?.some(t => t.name === 'BlackList')).length}
              </h3>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
              <span className="text-2xl">🚫</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors" onClick={handleDownloadSample}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('contacts.downloadSample')}</p>
              <h3 className="text-lg font-bold mt-1 text-primary">CSV Template</h3>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
              <FileDown className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">
                {filteredContacts.length} / {contacts.length} {t('contacts.title').toLowerCase()}
              </CardTitle>
            </div>
            
            <div className="flex gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`${t('common.search')}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              
              <div className="w-full sm:w-48">
                <Select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                >
                  <option value="all">{t('contacts.tags')}</option>
                  {tags.map(tag => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </Select>
              </div>
              
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => { setSelectedTag('all'); setSearchQuery(''); }}
                title="Clear filters"
                className="flex-shrink-0"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <ContactsTable
            contacts={filteredContacts}
            onDelete={handleDeleteClick}
            onManageTags={handleManageTags}
          />
        </CardContent>
      </Card>

      <ImportContacts
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImported={loadContacts}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ open, contactId: null })}
        onConfirm={handleDeleteConfirm}
        title={t('contacts.deleteContact')}
        description={t('contacts.deleteConfirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="destructive"
      />

      <TagManager
        contact={selectedContact}
        open={showTagManager}
        onOpenChange={(open) => {
          setShowTagManager(open);
          if (!open) setSelectedContact(null);
        }}
        onUpdated={loadContacts}
      />
    </div>
  );
}
