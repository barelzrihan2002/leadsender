import { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Upload, Download, FileDown, Search, Filter, Tags, Users, UserPlus, Settings, Trash2, X, CheckSquare, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import ContactsTable from '@/components/contacts/ContactsTable';
import ImportContacts from '@/components/contacts/ImportContacts';
import AddContactDialog from '@/components/contacts/AddContactDialog';
import TagManager from '@/components/contacts/TagManager';
import CustomFieldsManager from '@/components/contacts/CustomFieldsManager';
import BulkTagManager from '@/components/contacts/BulkTagManager';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import type { Contact, Tag, CustomField } from '@/types';

export default function Contacts() {
  const { t, language } = useLanguage();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showCustomFieldsManager, setShowCustomFieldsManager] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showBulkTagManager, setShowBulkTagManager] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    contactId: string | null;
  }>({ open: false, contactId: null });
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const [deleteAllDialog, setDeleteAllDialog] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalContacts, setTotalContacts] = useState(0);
  const [blacklistCount, setBlacklistCount] = useState(0);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const contactsPerPage = 200;
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadContacts();
    loadTags();
    loadCustomFields();
    loadBlacklistCount();
  }, []);

  useEffect(() => {
    // Reset to page 1 when tag filter changes (immediate)
    setCurrentPage(1);
    loadContacts();
  }, [selectedTag]);

  useEffect(() => {
    // Debounce search - wait 400ms after user stops typing
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      loadContacts();
    }, 400);
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    // Load contacts when page changes
    loadContacts();
  }, [currentPage]);

  const loadContacts = async () => {
    try {
      // Only show full loading spinner on first load
      if (isFirstLoad) {
        setLoading(true);
      }
      
      const result = await api.contacts.getPaginated({
        page: currentPage,
        limit: contactsPerPage,
        searchQuery: searchQuery,
        tagFilter: selectedTag
      });
      
      setContacts(result.contacts);
      setFilteredContacts(result.contacts);
      setTotalPages(result.totalPages);
      setTotalContacts(result.total);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
      setIsFirstLoad(false);
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

  const loadCustomFields = async () => {
    try {
      const data = await window.electron.customFields.getAll();
      setCustomFields(data);
    } catch (error) {
      console.error('Failed to load custom fields:', error);
    }
  };

  const loadBlacklistCount = async () => {
    try {
      const count = await api.contacts.getBlacklistCount();
      setBlacklistCount(count);
    } catch (error) {
      console.error('Failed to load blacklist count:', error);
    }
  };

  const handleContactsUpdated = () => {
    loadContacts();
    loadBlacklistCount();
  };

  const handleDeleteClick = (id: string) => {
    setConfirmDialog({ open: true, contactId: id });
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDialog.contactId) return;

    try {
      await api.contacts.delete(confirmDialog.contactId);
      loadContacts(); // Reload current page
      loadBlacklistCount(); // Update blacklist count
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

  // Bulk selection functions
  const toggleSelectContact = (contactId: string) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedContacts(new Set());
  };

  const handleDeleteAll = async () => {
    try {
      const count = await api.contacts.deleteAll();
      handleContactsUpdated();
      setDeleteAllDialog(false);
      toast.success(
        language === 'he' 
          ? `${count} אנשי קשר נמחקו בהצלחה`
          : language === 'ar'
          ? `تم حذف ${count} جهات اتصال بنجاح`
          : `${count} contacts deleted successfully`
      );
    } catch (error) {
      console.error('Failed to delete all contacts:', error);
      toast.error(t('toast.error'));
    }
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return;

    try {
      const deletePromises = Array.from(selectedContacts).map(id => 
        api.contacts.delete(id)
      );
      
      await Promise.all(deletePromises);
      
      toast.success(
        language === 'he' 
          ? `${selectedContacts.size} אנשי קשר נמחקו בהצלחה`
          : language === 'ar'
          ? `تم حذف ${selectedContacts.size} جهات اتصال بنجاح`
          : `${selectedContacts.size} contacts deleted successfully`
      );
      
      clearSelection();
      loadContacts();
      loadBlacklistCount();
      setBulkDeleteDialog(false);
    } catch (error) {
      console.error('Failed to delete contacts:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleBulkManageTags = () => {
    if (selectedContacts.size === 0) return;
    setShowBulkTagManager(true);
  };

  const handleExport = async () => {
    if (totalContacts === 0) {
      toast.warning(t('contacts.noContacts'));
      return;
    }

    try {
      // Get ALL contacts for export (not just current page)
      const allContacts = await api.contacts.getAll();
      
      // Prepare data for export including custom fields
      const exportData = allContacts.map(contact => {
        const baseData: any = {
          phone_number: contact.phone_number,
          name: contact.name || '',
          tags: contact.tags?.map(t => t.name).join(', ') || ''
        };
        
        // Add custom fields
        customFields.forEach(field => {
          baseData[field.name] = contact.custom_fields?.[field.name] || '';
        });
        
        return baseData;
      });

      // Create CSV content with custom fields
      const headers = ['phone_number', 'name', 'tags', ...customFields.map(f => f.name)];
      const csvRows = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const val = row[header] || '';
            return val.includes(',') ? `"${val}"` : val;
          }).join(',')
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
    } catch (error) {
      console.error('Failed to export contacts:', error);
      toast.error(language === 'he' ? 'שגיאה בייצוא אנשי קשר' : 'Failed to export contacts');
    }
  };

  const handleDownloadSample = () => {
    // Create sample CSV content with UTF-8 support including custom fields
    const headers = ['phone_number', 'name', 'tags', ...customFields.map(f => f.name)];
    
    const sampleData = language === 'he' 
      ? [
          ['972501234567', 'ישראל ישראלי', 'vip, לקוח_חדש', ...customFields.map(() => 'דוגמה')],
          ['972521234567', 'שרה כהן', 'לקוח', ...customFields.map(() => 'דוגמה')]
        ]
      : language === 'ar'
      ? [
          ['966501234567', 'أحمد محمد', 'vip, عميل_جديد', ...customFields.map(() => 'مثال')],
          ['966521234567', 'فاطمة علي', 'عميل', ...customFields.map(() => 'مثال')]
        ]
      : [
          ['972501234567', 'John Doe', 'vip, new_lead', ...customFields.map(() => 'example')],
          ['15551234567', 'Jane Smith', 'customer', ...customFields.map(() => 'example')]
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
          <Button variant="outline" onClick={() => setShowCustomFieldsManager(true)} className="shadow-sm">
            <Settings className="h-4 w-4 mr-2" />
            {language === 'he' ? 'שדות מותאמים' : language === 'ar' ? 'حقول مخصصة' : 'Custom Fields'}
          </Button>
          <Button variant="outline" onClick={handleExport} className="shadow-sm">
            <Download className="h-4 w-4 mr-2" />
            {t('common.export')}
          </Button>
          <Button variant="outline" onClick={() => setShowAddDialog(true)} className="shadow-sm">
            <UserPlus className="h-4 w-4 mr-2" />
            {t('contacts.addManually')}
          </Button>
          <Button onClick={() => setShowImportDialog(true)} className="shadow-md hover:shadow-lg transition-all">
            <Upload className="h-4 w-4 mr-2" />
            {t('contacts.importContacts')}
          </Button>
          {totalContacts > 0 && (
            <Button variant="destructive" onClick={() => setDeleteAllDialog(true)} className="shadow-sm">
              <Trash2 className="h-4 w-4 mr-2" />
              {language === 'he' ? 'מחק הכל' : language === 'ar' ? 'حذف الكل' : 'Delete All'}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{language === 'he' ? 'סה"כ אנשי קשר' : language === 'ar' ? 'إجمالي جهات الاتصال' : 'Total Contacts'}</p>
              <h3 className="text-2xl font-bold mt-1">{totalContacts}</h3>
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
                {blacklistCount}
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
                {language === 'he' 
                  ? `מציג ${filteredContacts.length} מתוך ${totalContacts} אנשי קשר`
                  : `Showing ${filteredContacts.length} of ${totalContacts} contacts`
                }
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

        {/* Bulk Actions Bar */}
        {selectedContacts.size > 0 && (
          <div className="bg-primary/10 border-y px-6 py-3 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <CheckSquare className="h-5 w-5 text-primary" />
              <span className="font-medium">
                {language === 'he' 
                  ? `${selectedContacts.size} אנשי קשר נבחרו`
                  : language === 'ar'
                  ? `تم تحديد ${selectedContacts.size} جهات اتصال`
                  : `${selectedContacts.size} contacts selected`
                }
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkManageTags}
                className="gap-2"
              >
                <Tags className="h-4 w-4" />
                {language === 'he' ? 'עריכת טאגים' : language === 'ar' ? 'تحرير العلامات' : 'Edit Tags'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkDeleteDialog(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {language === 'he' ? 'מחק הכל' : language === 'ar' ? 'حذف الكل' : 'Delete All'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                {language === 'he' ? 'ביטול' : language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        )}
        
        <CardContent className="p-0">
          <ContactsTable
            contacts={filteredContacts}
            customFields={customFields}
            selectedContacts={selectedContacts}
            onToggleSelect={toggleSelectContact}
            onToggleSelectAll={toggleSelectAll}
            onDelete={handleDeleteClick}
            onManageTags={handleManageTags}
          />
        </CardContent>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="border-t bg-muted/30 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {language === 'he' 
                  ? `עמוד ${currentPage} מתוך ${totalPages} (${totalContacts} סה"כ)`
                  : `Page ${currentPage} of ${totalPages} (${totalContacts} total)`
                }
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="h-8 w-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <ImportContacts
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImported={handleContactsUpdated}
      />

      <AddContactDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdded={handleContactsUpdated}
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
        onUpdated={handleContactsUpdated}
      />

      <CustomFieldsManager
        open={showCustomFieldsManager}
        onOpenChange={setShowCustomFieldsManager}
        onUpdated={() => {
          loadCustomFields();
          loadContacts(); // Reload contacts to refresh table with new fields
        }}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        open={bulkDeleteDialog}
        onOpenChange={setBulkDeleteDialog}
        onConfirm={handleBulkDelete}
        title={language === 'he' ? 'מחיקת אנשי קשר' : language === 'ar' ? 'حذف جهات الاتصال' : 'Delete Contacts'}
        description={
          language === 'he' 
            ? `האם אתה בטוח שברצונך למחוק ${selectedContacts.size} אנשי קשר? פעולה זו לא ניתנת לביטול.`
            : language === 'ar'
            ? `هل أنت متأكد من حذف ${selectedContacts.size} جهات اتصال؟ لا يمكن التراجع عن هذا الإجراء.`
            : `Are you sure you want to delete ${selectedContacts.size} contacts? This action cannot be undone.`
        }
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="destructive"
      />

      {/* Bulk Tag Manager */}
      <BulkTagManager
        open={showBulkTagManager}
        onOpenChange={setShowBulkTagManager}
        contactIds={Array.from(selectedContacts)}
        onUpdated={() => {
          handleContactsUpdated();
          clearSelection();
        }}
      />

      {/* Delete All Confirmation */}
      <ConfirmDialog
        open={deleteAllDialog}
        onOpenChange={setDeleteAllDialog}
        onConfirm={handleDeleteAll}
        title={language === 'he' ? 'מחיקת כל אנשי הקשר' : language === 'ar' ? 'حذف جميع جهات الاتصال' : 'Delete All Contacts'}
        description={
          language === 'he' 
            ? `האם אתה בטוח שברצונך למחוק את כל ${totalContacts} אנשי הקשר? פעולה זו לא ניתנת לביטול!`
            : language === 'ar'
            ? `هل أنت متأكد من حذف جميع ${totalContacts} جهات الاتصال؟ لا يمكن التراجع عن هذا الإجراء!`
            : `Are you sure you want to delete all ${totalContacts} contacts? This action cannot be undone!`
        }
        confirmText={language === 'he' ? 'מחק הכל' : language === 'ar' ? 'حذف الكل' : 'Delete All'}
        cancelText={t('common.cancel')}
        variant="destructive"
      />
    </div>
  );
}
