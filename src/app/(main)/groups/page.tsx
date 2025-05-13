
'use client';

import type { NextPage } from 'next';
import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getAuth, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { db } from '@/firebase/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp } from 'firebase/firestore';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Added import
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Folder as FolderIcon, Loader2, Sparkles, HelpCircle, Settings2, ShieldAlert, Film, BarChart, AlertCircle as AlertCircleIconLucide } from 'lucide-react';
import RightDrawer from '@/components/RightDrawer';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Group } from '@/app/(main)/cameras/page';
import { generateGroupAlertEvents } from '@/ai/flows/generate-group-alert-events';


const addGroupSchema = z.object({
  groupName: z.string().min(1, "Group name is required."),
  defaultCameraSceneContext: z.string().optional(),
  defaultAiDetectionTarget: z.string().optional(),
  defaultAlertEvents: z.string().optional(),
  defaultVideoChunksValue: z.string().optional().refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), { message: "Must be a number" }),
  defaultVideoChunksUnit: z.enum(['seconds', 'minutes']).optional(),
  defaultNumFrames: z.string().optional().refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), { message: "Must be a number" }),
  defaultVideoOverlapValue: z.string().optional().refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), { message: "Must be a number" }),
  defaultVideoOverlapUnit: z.enum(['seconds', 'minutes']).optional(),
});

type AddGroupFormValues = z.infer<typeof addGroupSchema>;


const GroupsPage: NextPage = () => {
  const [isAddGroupDrawerOpen, setIsAddGroupDrawerOpen] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [isGeneratingGroupAlerts, setIsGeneratingGroupAlerts] = useState(false);

  const { toast } = useToast();
  const { translate, language } = useLanguage();

  const addGroupForm = useForm<AddGroupFormValues>({
    resolver: zodResolver(addGroupSchema),
    mode: "onChange",
    defaultValues: {
      groupName: '',
      defaultCameraSceneContext: '',
      defaultAiDetectionTarget: '',
      defaultAlertEvents: '',
      defaultVideoChunksValue: '10',
      defaultVideoChunksUnit: 'seconds',
      defaultNumFrames: '5',
      defaultVideoOverlapValue: '2',
      defaultVideoOverlapUnit: 'seconds',
    },
  });

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const organizationId = userDocSnap.data()?.organizationId;
          setOrgId(organizationId);
          if (organizationId) {
            fetchGroups(organizationId);
          } else {
            setGroups([]);
            setIsLoadingGroups(false);
          }
        } else {
          setGroups([]);
          setIsLoadingGroups(false);
        }
      } else {
        setGroups([]);
        setIsLoadingGroups(false);
        setOrgId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchGroups = async (currentOrgId: string) => {
    setIsLoadingGroups(true);
    try {
      const q = query(collection(db, 'groups'), where('orgId', '==', currentOrgId));
      const querySnapshot = await getDocs(q);
      const fetchedGroups = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          name: data.name,
          cameras: data.cameras || [],
          videos: data.videos || [],
          defaultCameraSceneContext: data.defaultCameraSceneContext,
          defaultAiDetectionTarget: data.defaultAiDetectionTarget,
          defaultAlertEvents: data.defaultAlertEvents,
          defaultVideoChunks: data.defaultVideoChunks,
          defaultNumFrames: data.defaultNumFrames,
          defaultVideoOverlap: data.defaultVideoOverlap,
        } as Group;
      });
      setGroups(fetchedGroups);
    } catch (error) {
      console.error("Error fetching groups: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch groups.' });
    }
    setIsLoadingGroups(false);
  };

  const handleAddGroupClick = () => {
    addGroupForm.reset({
      groupName: '',
      defaultCameraSceneContext: '',
      defaultAiDetectionTarget: '',
      defaultAlertEvents: '',
      defaultVideoChunksValue: '10',
      defaultVideoChunksUnit: 'seconds',
      defaultNumFrames: '5',
      defaultVideoOverlapValue: '2',
      defaultVideoOverlapUnit: 'seconds',
    });
    setIsAddGroupDrawerOpen(true);
  };

  const handleAddGroupDrawerClose = () => {
    setIsAddGroupDrawerOpen(false);
  };

  const handleGenerateGroupAlertsForNewGroup = async () => {
    const detectionTarget = addGroupForm.getValues('defaultAiDetectionTarget');
    if (!detectionTarget || detectionTarget.trim() === "") {
      toast({
        variant: "destructive",
        title: "Input Required",
        description: "Please enter a default AI detection target first.",
      });
      return;
    }
    setIsGeneratingGroupAlerts(true);
    try {
      const response = await generateGroupAlertEvents({ aiDetectionTarget: detectionTarget, language: language });
      if (response && response.suggestedAlertEvents && !response.suggestedAlertEvents.startsWith("Error:")) {
        addGroupForm.setValue('defaultAlertEvents', response.suggestedAlertEvents);
        toast({
          title: "Alerts Generated",
          description: "Suggested default alert events have been populated.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Generation Failed",
          description: response.suggestedAlertEvents || "Could not generate alert events.",
        });
      }
    } catch (error) {
      console.error("Error generating group alert events:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred while generating alert events.",
      });
    } finally {
      setIsGeneratingGroupAlerts(false);
    }
  };

  const onSubmitAddGroup: SubmitHandler<AddGroupFormValues> = async (data) => {
    if (!currentUser || !orgId) {
      toast({ variant: 'destructive', title: 'Error', description: 'User or organization not identified.' });
      return;
    }
    setIsSubmittingGroup(true);
    try {
      const newGroupData: Omit<Group, 'id'> = { // Use Omit to exclude id as it's auto-generated
        name: data.groupName,
        orgId: orgId,
        userId: currentUser.uid,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        cameras: [],
        videos: [],
        defaultCameraSceneContext: data.defaultCameraSceneContext || null,
        defaultAiDetectionTarget: data.defaultAiDetectionTarget || null,
        defaultAlertEvents: data.defaultAlertEvents ? data.defaultAlertEvents.split(',').map(ae => ae.trim()).filter(ae => ae) : null,
        defaultVideoChunks: data.defaultVideoChunksValue ? { value: parseFloat(data.defaultVideoChunksValue), unit: data.defaultVideoChunksUnit || 'seconds' } : null,
        defaultNumFrames: data.defaultNumFrames ? parseInt(data.defaultNumFrames, 10) : null,
        defaultVideoOverlap: data.defaultVideoOverlapValue ? { value: parseFloat(data.defaultVideoOverlapValue), unit: data.defaultVideoOverlapUnit || 'seconds' } : null,
      };
      await addDoc(collection(db, 'groups'), newGroupData);
      toast({ title: 'Group Created', description: `${data.groupName} has been successfully created.` });
      if (orgId) fetchGroups(orgId); // Refresh list
      handleAddGroupDrawerClose();
    } catch (error) {
      console.error("Error creating group: ", error);
      toast({ variant: 'destructive', title: 'Creation Failed', description: 'Could not create the group.' });
    }
    setIsSubmittingGroup(false);
  };


  const renderAddGroupDrawerContent = () => (
    <div className="p-6">
      <Form {...addGroupForm}>
        <form id="add-group-form" onSubmit={addGroupForm.handleSubmit(onSubmitAddGroup)} className="space-y-8">
          <FormField
            control={addGroupForm.control}
            name="groupName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center mb-1.5">
                  <FolderIcon className="w-4 h-4 mr-2 text-muted-foreground" />Group Name
                </FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Warehouse Zone 1, Office Entrances" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Card className="p-4 bg-muted/50">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Default Group Configurations (Optional)</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">These settings will apply to new cameras added to this group, unless overridden.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <FormField
                control={addGroupForm.control}
                name="defaultCameraSceneContext"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center mb-1.5 text-xs">
                      <HelpCircle className="w-3.5 h-3.5 mr-2 text-muted-foreground" />What are cameras in this group typically looking at?
                    </FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Monitors main entrance and exit points, overlooks the packaging area." {...field} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addGroupForm.control}
                name="defaultAiDetectionTarget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center mb-1.5 text-xs">
                      <Settings2 className="w-3.5 h-3.5 mr-2 text-muted-foreground" />What should AI generally detect for this group?
                    </FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Detect unauthorized personnel, loitering, package theft, safety gear violations." {...field} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addGroupForm.control}
                name="defaultAlertEvents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between mb-1.5 text-xs">
                      <span className="flex items-center">
                        <ShieldAlert className="w-3.5 h-3.5 mr-2 text-muted-foreground" />Default Alert Events
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateGroupAlertsForNewGroup}
                        disabled={isGeneratingGroupAlerts || !addGroupForm.watch('defaultAiDetectionTarget')}
                        className="text-xs h-7"
                      >
                        {isGeneratingGroupAlerts ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                        Suggest
                      </Button>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., security: zone breach, safety: ppe missing" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">Comma-separated default alert events for the group.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-y-4 pt-2">
                <Label className="text-xs font-medium text-muted-foreground col-span-full">Default Video Processing Config:</Label>
                <div className="grid grid-cols-2 gap-x-4">
                  <FormField control={addGroupForm.control} name="defaultVideoChunksValue" render={({ field }) => (<FormItem> <FormLabel className="text-xs">Video Chunks</FormLabel> <FormControl><Input type="number" placeholder="10" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={addGroupForm.control} name="defaultVideoChunksUnit" render={({ field }) => (<FormItem className="self-end"> <Select onValueChange={field.onChange} defaultValue={field.value || 'seconds'}><FormControl><SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger></FormControl><SelectContent><SelectItem value="seconds">Secs</SelectItem><SelectItem value="minutes">Mins</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  <FormField control={addGroupForm.control} name="defaultVideoOverlapValue" render={({ field }) => (<FormItem> <FormLabel className="text-xs">Video Overlap</FormLabel> <FormControl><Input type="number" placeholder="2" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={addGroupForm.control} name="defaultVideoOverlapUnit" render={({ field }) => (<FormItem className="self-end"> <Select onValueChange={field.onChange} defaultValue={field.value || 'seconds'}><FormControl><SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger></FormControl><SelectContent><SelectItem value="seconds">Secs</SelectItem><SelectItem value="minutes">Mins</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
                <FormField control={addGroupForm.control} name="defaultNumFrames" render={({ field }) => (<FormItem> <FormLabel className="text-xs">No. of Frames</FormLabel> <FormControl><Input type="number" placeholder="5" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );

  const addGroupDrawerFooter = () => (
    <div className="flex justify-between p-4 border-t">
      <Button variant="outline" onClick={handleAddGroupDrawerClose} disabled={isSubmittingGroup}>Cancel</Button>
      <Button
        type="submit"
        form="add-group-form"
        disabled={isSubmittingGroup || !addGroupForm.formState.isValid}
      >
        {isSubmittingGroup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Group
      </Button>
    </div>
  );


  return (
    <div>
      <Card>
        <CardHeader className="border-b">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="text-lg font-normal text-primary">{translate('groups')}</CardTitle>
                    <CardDescription className="text-xs mt-1 text-muted-foreground">
                    Manage and organize your camera groups.
                    </CardDescription>
                </div>
                <Button size="sm" onClick={handleAddGroupClick}>
                    <Plus className="mr-2 h-4 w-4" /> Add Group
                </Button>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            {isLoadingGroups ? (
                <div className="flex justify-center items-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : groups.length === 0 ? (
                <div className="mt-4 p-4 border rounded-md bg-muted text-center">
                    <FolderIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-md font-semibold text-foreground mb-1">No Camera Groups Yet</h3>
                    <p className="text-sm text-muted-foreground">Organize your cameras by creating groups for easier management and monitoring.</p>
                    <Button variant="link" onClick={handleAddGroupClick} className="mt-2 text-sm">
                        <Plus className="mr-1 h-3.5 w-3.5" /> Create Your First Group
                    </Button>
                </div>

            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Cameras</TableHead>
                                <TableHead>Videos</TableHead>
                                <TableHead className="sticky right-0 bg-card z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {groups.map(group => (
                            <TableRow key={group.id}>
                            <TableCell className="font-medium">{group.name}</TableCell>
                            <TableCell>{group.cameras?.length || 0}</TableCell>
                            <TableCell>{group.videos?.length || 0}</TableCell>
                            <TableCell className="sticky right-0 bg-card z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">
                                <Button variant="outline" size="sm" className="text-xs">View Details</Button>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </CardContent>
      </Card>


      <RightDrawer
        isOpen={isAddGroupDrawerOpen}
        onClose={handleAddGroupDrawerClose}
        title="Add New Group"
        footerContent={addGroupDrawerFooter()}
      >
        {renderAddGroupDrawerContent()}
      </RightDrawer>
    </div>
  );
};

export default GroupsPage;

