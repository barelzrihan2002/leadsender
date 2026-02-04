import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Tag, User, Phone } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Contact } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ContactsTableProps {
  contacts: Contact[];
  onDelete: (id: string) => void;
  onManageTags: (contact: Contact) => void;
}

export default function ContactsTable({ contacts, onDelete, onManageTags }: ContactsTableProps) {
  const { t, language } = useLanguage();
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-[300px]">{language === 'he' ? 'שם איש קשר' : 'Contact Name'}</TableHead>
            <TableHead>{t('contacts.phoneNumber')}</TableHead>
            <TableHead>{t('contacts.tags')}</TableHead>
            <TableHead className={language === 'rtl' ? 'text-left' : 'text-right'}>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                <div className="flex flex-col items-center justify-center py-6">
                  <User className="h-8 w-8 mb-2 opacity-20" />
                  <p>{t('contacts.noContacts')}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            contacts.map((contact) => {
              const isBlacklisted = contact.tags?.some(tag => tag.name === 'BlackList');
              
              return (
              <TableRow 
                key={contact.id} 
                className={`group hover:bg-muted/30 transition-colors ${isBlacklisted ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${contact.name || contact.phone_number}`} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {(contact.name?.[0] || '#').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{contact.name || t('contacts.unknownContact')}</span>
                        {isBlacklisted && (
                          <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full font-medium border border-red-200 dark:border-red-800">
                            🚫 BlackList
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {t('contacts.added')} {new Date(contact.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span className="font-mono text-sm">{contact.phone_number}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1.5 flex-wrap">
                    {contact.tags && contact.tags.length > 0 ? (
                      contact.tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="secondary"
                          className="font-normal px-2 py-0.5"
                          style={{ 
                            backgroundColor: tag.color ? `${tag.color}15` : undefined,
                            color: tag.color,
                            borderColor: tag.color ? `${tag.color}30` : undefined
                          }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: tag.color || 'currentColor' }} />
                          {tag.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">{t('contacts.noTagsForContact')}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className={language === 'rtl' ? 'text-left' : 'text-right'}>
                  <div className={`flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${language === 'rtl' ? 'justify-start' : 'justify-end'}`}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                      onClick={() => onManageTags(contact)}
                      title={t('contacts.manageTagsTooltip')}
                    >
                      <Tag className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onDelete(contact.id)}
                      title={t('contacts.deleteContactTooltip')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
