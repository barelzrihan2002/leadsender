import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import type { Account, Tag } from '@/types';

interface CreateCampaignProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: () => void;
}

export default function CreateCampaign({ open, onOpenChange, onCampaignCreated }: CreateCampaignProps) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    message: '',
    min_delay: 30,
    max_delay: 60,
    max_messages_per_day: 100,
    start_hour: 9,
    end_hour: 18
  });

  useEffect(() => {
    if (open) {
      loadAccounts();
      loadTags();
    }
  }, [open]);

  const loadAccounts = async () => {
    const data = await api.accounts.getAll();
    setAccounts(data.filter(acc => acc.status === 'connected'));
  };

  const loadTags = async () => {
    const data = await api.tags.getAll();
    // Filter out BlackList and other system tags
    const filteredTags = data.filter(tag => tag.name !== 'BlackList' && !tag.is_system);
    setTags(filteredTags);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create campaign
      const campaign = await api.campaigns.create(formData);

      // Add accounts to campaign
      if (selectedAccounts.length > 0) {
        await api.campaigns.addAccounts(campaign.id, selectedAccounts);
      }

      // Get contacts by tags and add to campaign
      if (selectedTags.length > 0) {
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
      }

      onCampaignCreated();
      handleClose();
      toast.success('Campaign created successfully');
    } catch (error) {
      console.error('Failed to create campaign:', error);
      toast.error('Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      message: '',
      min_delay: 30,
      max_delay: 60,
      max_messages_per_day: 100,
      start_hour: 9,
      end_hour: 18
    });
    setSelectedAccounts([]);
    setSelectedTags([]);
    onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Summer Sale 2024"
            />
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              required
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Hi {{name}}, we have a special offer for you..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Available variables: {'{{name}}'}, {'{{phone}}'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="min_delay">Min Delay (seconds)</Label>
              <Input
                id="min_delay"
                type="number"
                required
                value={formData.min_delay}
                onChange={(e) => setFormData({ ...formData, min_delay: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="max_delay">Max Delay (seconds)</Label>
              <Input
                id="max_delay"
                type="number"
                required
                value={formData.max_delay}
                onChange={(e) => setFormData({ ...formData, max_delay: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="max_messages_per_day">Max Messages Per Day (per account)</Label>
            <Input
              id="max_messages_per_day"
              type="number"
              required
              value={formData.max_messages_per_day}
              onChange={(e) => setFormData({ ...formData, max_messages_per_day: parseInt(e.target.value) })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_hour">Start Hour (0-23)</Label>
              <Input
                id="start_hour"
                type="number"
                required
                min="0"
                max="23"
                value={formData.start_hour}
                onChange={(e) => setFormData({ ...formData, start_hour: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="end_hour">End Hour (0-23)</Label>
              <Input
                id="end_hour"
                type="number"
                required
                min="0"
                max="23"
                value={formData.end_hour}
                onChange={(e) => setFormData({ ...formData, end_hour: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <Label>Select Accounts</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No connected accounts</p>
              ) : (
                accounts.map(account => (
                  <label key={account.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(account.id)}
                      onChange={() => toggleAccount(account.id)}
                    />
                    <span className="text-sm">{account.name || account.phone_number}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <Label>Select Contact Tags</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tags available</p>
              ) : (
                tags.map(tag => (
                  <label key={tag.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                    />
                    <span className="text-sm">{tag.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || selectedAccounts.length === 0}>
              {loading ? 'Creating...' : 'Create Campaign'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
