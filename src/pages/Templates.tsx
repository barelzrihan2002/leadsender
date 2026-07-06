import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, FileText, Image as ImageIcon, Video, File } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/components/ui/use-toast';
import CreateTemplateDialog from '@/components/templates/CreateTemplateDialog';
import type { MessageTemplate } from '@/types';

export default function Templates() {
  const { t, language } = useLanguage();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await window.electron.templates.getAll();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error(t('toast.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('templates.deleteConfirm'))) return;
    
    try {
      await window.electron.templates.delete(id);
      await loadTemplates();
      toast.success(t('toast.success'));
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error(t('toast.error'));
    }
  };

  const getMediaIcon = (mediaType?: string) => {
    if (!mediaType) return null;
    
    switch (mediaType) {
      case 'image':
        return <ImageIcon className="h-4 w-4 text-blue-500" />;
      case 'video':
        return <Video className="h-4 w-4 text-purple-500" />;
      case 'document':
        return <File className="h-4 w-4 text-orange-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{t('templates.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('templates.subtitle')}</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('templates.createNew')}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          {t('common.loading')}
        </div>
      ) : templates.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('templates.noTemplates')}</h3>
            <Button onClick={() => setShowCreateDialog(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              {t('templates.createNew')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {template.name}
                      {template.media_type && getMediaIcon(template.media_type)}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm bg-muted/50 p-3 rounded-md max-h-24 overflow-y-auto">
                  {template.message.substring(0, 150)}
                  {template.message.length > 150 && '...'}
                </div>

                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => {
                      setEditingTemplate(template);
                      setShowCreateDialog(true);
                    }}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    {t('common.edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateTemplateDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) setEditingTemplate(null);
        }}
        template={editingTemplate}
        onSaved={loadTemplates}
      />
    </div>
  );
}
