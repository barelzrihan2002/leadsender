import { ArrowLeft, Send, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CampaignTypePickerPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const title = language === 'he'
    ? 'בחר סוג קמפיין'
    : language === 'ar'
    ? 'اختر نوع الحملة'
    : 'Choose campaign type';

  const subtitle = language === 'he'
    ? 'צור קמפיין הודעות רגיל או קמפיין הוספה לקבוצה.'
    : language === 'ar'
    ? 'أنشئ حملة رسائل عادية أو حملة إضافة إلى مجموعة.'
    : 'Create a regular messaging campaign or a group adder campaign.';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/campaigns')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {language === 'he' ? 'חזרה' : language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="cursor-pointer border-primary/30 transition-colors hover:border-primary" onClick={() => navigate('/campaigns/create/message')}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Send className="h-6 w-6" />
              </div>
              <div>
                <CardTitle>{language === 'he' ? 'קמפיין הודעות' : language === 'ar' ? 'حملة رسائل' : 'Message Campaign'}</CardTitle>
                <CardDescription>
                  {language === 'he'
                    ? 'שלח הודעות או מדיה לקהל לפי תגיות.'
                    : language === 'ar'
                    ? 'أرسل رسائل أو وسائط لجمهور حسب الوسوم.'
                    : 'Send messages or media to an audience filtered by tags.'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/campaigns/create/message')}>
              {language === 'he' ? 'המשך לקמפיין הודעות' : language === 'ar' ? 'متابعة إلى حملة الرسائل' : 'Continue to message campaign'}
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer border-emerald-300 transition-colors hover:border-emerald-500" onClick={() => navigate('/campaigns/create/group-adder')}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <UserPlus className="h-6 w-6" />
              </div>
              <div>
                <CardTitle>{language === 'he' ? 'Group Adder Campaign' : language === 'ar' ? 'حملة إضافة إلى مجموعة' : 'Group Adder Campaign'}</CardTitle>
                <CardDescription>
                  {language === 'he'
                    ? 'בחר קבוצה, תגיות וחשבונות שמוסיפים משתתפים בהדרגה.'
                    : language === 'ar'
                    ? 'اختر مجموعة ووسومًا وحسابات تضيف المشاركين تدريجيًا.'
                    : 'Pick a group, tags, and accounts that add participants gradually.'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate('/campaigns/create/group-adder')}>
              {language === 'he' ? 'המשך ל־Group Adder' : language === 'ar' ? 'متابعة إلى إضافة المجموعة' : 'Continue to group adder'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
