
'use client';

import type { Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';
import type { AddCameraStep3Values } from '@/app/(main)/cameras/types';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Diamond, PlusCircle, Trash2, Loader2, Sparkles } from 'lucide-react';

interface AlertConfigurationFormProps {
  control: Control<AddCameraStep3Values>;
  setValue: UseFormSetValue<AddCameraStep3Values>; // To set alertName and events from AI
  getValues: (name: keyof AddCameraStep3Values) => any; // To get aiDetectionTarget for suggestions
  errors: FieldErrors<AddCameraStep3Values>;
  handleSuggestAlertEvents: () => Promise<void>;
  isSuggestingAlertEvents: boolean;
}

const AlertConfigurationForm: React.FC<AlertConfigurationFormProps> = ({
  control,
  setValue,
  getValues,
  errors,
  handleSuggestAlertEvents,
  isSuggestingAlertEvents,
}) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "events",
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <FormLabel className="flex items-center text-base">
          <Diamond className="w-4 h-4 mr-2 text-muted-foreground" />
          Define Alert Details
        </FormLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSuggestAlertEvents}
          disabled={isSuggestingAlertEvents || !getValues('aiDetectionTarget')}
          className="text-xs"
        >
          {isSuggestingAlertEvents ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
          Suggest Alert & Events
        </Button>
      </div>

      <div className="space-y-4 border rounded-md p-4">
        <FormField
          control={control}
          name="alertName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center text-xs">Alert Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Restricted Area Monitoring" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <FormLabel className="flex items-center text-xs mb-1">Event String(s)</FormLabel>
          {fields.map((item, index) => (
            <div key={item.id} className="flex items-center space-x-2 mb-2">
              <FormField
                control={control}
                name={`events.${index}.value`}
                render={({ field }) => (
                  <FormItem className="flex-grow">
                    <FormControl>
                      <Input placeholder="e.g., Fire, Intrusion, Person detected" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => remove(index)}
                className="h-9 w-9"
                disabled={fields.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Remove Event</span>
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ value: "" })}
            className="text-xs mt-2"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add Event String
          </Button>
          {errors.events && typeof errors.events.message === 'string' && (
            <FormMessage className="mt-1">{errors.events.message}</FormMessage>
          )}
          {Array.isArray(errors.events) && errors.events.length > 0 && !errors.events.message && (
             <FormMessage className="mt-1">At least one event string is required.</FormMessage>
          )}
        </div>
      </div>
      {isSuggestingAlertEvents && <p className="text-xs text-muted-foreground mt-1 text-primary">AI is generating suggestions for Alert Name & Events...</p>}
    </div>
  );
};

export default AlertConfigurationForm;
