
'use client';

import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageLoading } from '@/contexts/LoadingContext';

interface OrganizationData {
  name: string;
}

const ManageOrganizationBillingPage: NextPage = () => {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orgId = params.orgId as string;
  const { translate } = useLanguage();
  const { setIsPageLoading } = usePageLoading();

  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;

    const fetchOrganizationData = async () => {
      setLoading(true);
      try {
        const orgDocRef = doc(db, 'organizations', orgId);
        const orgDocSnap = await getDoc(orgDocRef);

        if (!orgDocSnap.exists()) {
          toast({ variant: 'destructive', title: 'Error', description: 'Organization not found.' });
          setIsPageLoading(true);
          router.push('/system-admin/organizations');
          return;
        }
        setOrganization(orgDocSnap.data() as OrganizationData);
      } catch (error) {
        console.error("Error fetching organization data: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch organization data.' });
      }
      setLoading(false);
    };

    fetchOrganizationData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, toast, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8 h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex justify-center items-center p-8 h-full">
        <p>Organization data could not be loaded.</p>
      </div>
    );
  }

  return (
    <div>
      <Button variant="outline" onClick={() => {setIsPageLoading(true); router.push('/system-admin/organizations');}} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Organizations
      </Button>
      <Card>
        <CardHeader className="border-b">
            <CardTitle>{translate('manageBilling.pageTitle')}</CardTitle>
            <CardDescription className="text-xs mt-1">
                {translate('manageBilling.description', { orgName: organization.name })}
            </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center text-center py-12">
            <BarChart3 className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Billing & Usage Insights</h3>
            <p className="text-muted-foreground">
              {translate('manageBilling.noData')}
            </p>
            {/* Placeholder for billing and usage data/charts */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageOrganizationBillingPage;
