import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import {
  GenericSelectBottomSheet,
  type SelectItem,
} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import {resolveObservationalToolLabel} from '@/features/tasks/utils/taskLabels';
import {
  observationToolApi,
  type ObservationToolDefinitionRemote,
} from '@/features/observationalTools/services/observationToolService';

let _tools: ObservationToolDefinitionRemote[] = [];
let _toolsLoaded = false;
let _toolsFetching = false;
const _toolsListeners = new Set<() => void>();

function _notifyTools() {
  _toolsListeners.forEach(l => l());
}

function _startFetchTools() {
  if (_toolsFetching) return;
  _toolsFetching = true;
  observationToolApi
    .list({onlyActive: true})
    .then(list => {
      _tools = list;
    })
    .catch(error => {
      console.warn(
        '[ObservationalToolBottomSheet] Failed to fetch tools',
        error,
      );
    })
    .finally(() => {
      _toolsLoaded = true;
      _notifyTools();
    });
}

function _subscribeTools(listener: () => void) {
  _toolsListeners.add(listener);
  _startFetchTools();
  return () => {
    _toolsListeners.delete(listener);
  };
}

function _getToolsSnapshot(): ObservationToolDefinitionRemote[] {
  return _tools;
}

function _getToolsLoadingSnapshot(): boolean {
  return !_toolsLoaded;
}

export function _resetToolsStoreForTesting() {
  _tools = [];
  _toolsLoaded = false;
  _toolsFetching = false;
  _toolsListeners.clear();
}

export interface ObservationalToolBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface ObservationalToolBottomSheetProps {
  selectedTool?: string | null;
  onSelect: (tool: string) => void;
  companionType: 'cat' | 'dog' | 'horse';
  onSheetChange?: (index: number) => void;
}

export const ObservationalToolBottomSheet = forwardRef<
  ObservationalToolBottomSheetRef,
  ObservationalToolBottomSheetProps
>(({selectedTool, onSelect, companionType, onSheetChange}, ref) => {
  const bottomSheetRef = useRef<any>(null);
  const tools = useSyncExternalStore(
    _subscribeTools,
    _getToolsSnapshot,
    _getToolsSnapshot,
  );
  const loading = useSyncExternalStore(
    _subscribeTools,
    _getToolsLoadingSnapshot,
    _getToolsLoadingSnapshot,
  );

  useImperativeHandle(ref, () => ({
    open: () => bottomSheetRef.current?.open(),
    close: () => bottomSheetRef.current?.close(),
  }));

  const inferSpeciesFromName = (name?: string | null) => {
    const normalized = (name ?? '').toLowerCase();
    if (normalized.includes('feline') || normalized.includes('cat'))
      return 'cat';
    if (normalized.includes('canine') || normalized.includes('dog'))
      return 'dog';
    if (normalized.includes('equine') || normalized.includes('horse'))
      return 'horse';
    return null;
  };

  const availableTools = useMemo(() => {
    return tools.filter(tool => {
      const species = inferSpeciesFromName(tool.name);
      return !species || species === companionType;
    });
  }, [companionType, tools]);

  const toolItems: SelectItem[] = useMemo(
    () =>
      availableTools.map(tool => ({
        id: tool.id,
        label: tool.name ?? resolveObservationalToolLabel(tool.id),
      })),
    [availableTools],
  );

  const selectedItem = selectedTool
    ? {
        id: selectedTool,
        label:
          tools.find(tool => tool.id === selectedTool)?.name ??
          resolveObservationalToolLabel(selectedTool),
      }
    : null;

  const emptyMessage = loading
    ? 'Loading observational tools...'
    : 'No observational tools available for this companion';

  const handleSave = (item: SelectItem | null) => {
    if (item) {
      onSelect(item.id);
    }
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Select observational tool"
      items={toolItems}
      selectedItem={selectedItem}
      onSave={handleSave}
      hasSearch={false}
      mode="select"
      snapPoints={['35%', '40%']}
      emptyMessage={emptyMessage}
      onSheetChange={onSheetChange}
    />
  );
});

export default ObservationalToolBottomSheet;
