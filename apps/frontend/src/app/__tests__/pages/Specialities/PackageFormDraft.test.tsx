import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PackageFormDraft from '@/app/features/organization/pages/Specialities/PackageFormDraft';
import { PackageRevamp } from '@/app/features/organization/types/revamp';

jest.mock('react-icons/md', () => ({
  MdOutlineArchive: () => <span data-testid="icon-archive" />,
}));
jest.mock('react-icons/fi', () => ({
  FiCheck: () => <span data-testid="icon-check" />,
}));
jest.mock('react-icons/io', () => ({
  IoIosSearch: () => <span data-testid="icon-search" />,
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({
    inlabel,
    value,
    onChange,
    error,
    readonly,
    intype,
  }: {
    inlabel: string;
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
    readonly?: boolean;
    intype?: string;
  }) => (
    <div>
      <label htmlFor={`fi-${inlabel}`}>{inlabel}</label>
      <input
        id={`fi-${inlabel}`}
        aria-label={inlabel}
        type={intype ?? 'text'}
        value={value}
        onChange={onChange ?? (() => {})}
        readOnly={readonly}
      />
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({
    placeholder,
    options,
    onSelect,
  }: {
    placeholder: string;
    options: { value: string; label: string }[];
    onSelect: (o: { value: string; label: string }) => void;
  }) => (
    <div>
      <label htmlFor={`dd-${placeholder}`}>{placeholder}</label>
      <select
        id={`dd-${placeholder}`}
        aria-label={placeholder}
        onChange={(e) => {
          const opt = options.find((o) => o.value === e.target.value);
          if (opt) onSelect(opt);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Primary', () => ({
  __esModule: true,
  default: ({ text, onClick }: { text: string; onClick?: (e: React.MouseEvent) => void }) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Secondary', () => ({
  __esModule: true,
  default: ({ text, onClick }: { text: string; onClick?: (e: React.MouseEvent) => void }) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/SectionContainer/SectionContainer', () => ({
  __esModule: true,
  default: ({
    title,
    children,
    titleSlot,
  }: {
    title: string;
    children: React.ReactNode;
    titleSlot?: React.ReactNode;
    nested?: boolean;
  }) => (
    <div>
      <h2>{title}</h2>
      {titleSlot && <div data-testid="title-slot">{titleSlot}</div>}
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/Badge', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}));

jest.mock('@/app/features/organization/pages/Specialities/PackageBreakdownTable', () => ({
  __esModule: true,
  default: ({
    items,
    onRemoveItem,
    onChangeQty,
    onChangeDiscount,
  }: {
    items: { id: string; name: string }[];
    onRemoveItem: (id: string) => void;
    onChangeQty: (id: string, qty: number) => void;
    onChangeDiscount: (id: string, discount: number) => void;
  }) => (
    <div data-testid="breakdown-table">
      {items.map((item) => (
        <div key={item.id} data-testid={`breakdown-item-${item.id}`}>
          <span>{item.name}</span>
          <button type="button" onClick={() => onRemoveItem(item.id)}>
            Remove {item.name}
          </button>
          <button type="button" onClick={() => onChangeQty(item.id, 2)}>
            Change Qty
          </button>
          <button type="button" onClick={() => onChangeDiscount(item.id, 5)}>
            Change Discount
          </button>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (fn: any) => fn,
}));

jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/features/organization/services/revampMockData', () => ({
  computePackageTotals: jest.fn((pkg: any) => ({
    totalCost: 200,
    totalItems: pkg.breakdown?.length ?? 0,
  })),
}));

const mockNotify = jest.fn();
const mockAddPackage = jest.fn();
const mockUpdatePackage = jest.fn();
const mockArchivePackage = jest.fn();

import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';

const setupStoreMock = (packages: any[] = []) => {
  (useRevampCatalogStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: Record<string, unknown>) => unknown) => {
      const state = {
        addPackage: mockAddPackage,
        updatePackage: mockUpdatePackage,
        archivePackage: mockArchivePackage,
        packages,
      };
      return selector(state);
    }
  );
};

const defaultProps = {
  specialityId: 'spec-1',
  organisationId: 'org-1',
  onClose: jest.fn(),
};

const mockEditPackage: PackageRevamp = {
  id: 'pkg-edit-1',
  code: 'PKG-001',
  name: 'Wellness Package',
  description: 'A wellness package',
  specialityId: 'spec-1',
  organisationId: 'org-1',
  durationMinutes: 60,
  leadCount: 1,
  supportCount: 2,
  isBookable: true,
  additionalDiscount: 5,
  breakdown: [
    {
      id: 'b1',
      name: 'Radiographic Consultation',
      type: 'CONSULTATION',
      unitPrice: 100,
      quantity: 1,
      discount: 0,
      maxDiscount: 15,
    },
  ],
  status: 'ACTIVE',
  createdAt: '2025-01-01T00:00:00Z',
};

describe('PackageFormDraft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupStoreMock();
    defaultProps.onClose = jest.fn();
  });

  describe('create mode', () => {
    it('renders the draft title for a new package', () => {
      render(<PackageFormDraft {...defaultProps} />);
      expect(screen.getByText('New Package (draft)')).toBeInTheDocument();
    });

    it('renders Name and Description fields', () => {
      render(<PackageFormDraft {...defaultProps} />);
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });

    it('renders Duration, Lead and Support dropdowns', () => {
      render(<PackageFormDraft {...defaultProps} />);
      expect(screen.getByLabelText('Duration')).toBeInTheDocument();
      expect(screen.getByLabelText('Lead')).toBeInTheDocument();
      expect(screen.getByLabelText('Support')).toBeInTheDocument();
    });

    it('renders the bookable checkbox unchecked by default', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const checkbox = screen.getByLabelText('Package bookable') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('renders the catalog search input', () => {
      render(<PackageFormDraft {...defaultProps} />);
      expect(screen.getByLabelText('Search catalog items')).toBeInTheDocument();
    });

    it('shows empty breakdown message when no items added', () => {
      render(<PackageFormDraft {...defaultProps} />);
      expect(
        screen.getByText('Search above to add items to the package breakdown.')
      ).toBeInTheDocument();
    });

    it('does not render Archive Package button in create mode', () => {
      render(<PackageFormDraft {...defaultProps} />);
      expect(screen.queryByText('Archive Package')).not.toBeInTheDocument();
    });

    it('shows Cancel and Save Package buttons', () => {
      render(<PackageFormDraft {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Package' })).toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', () => {
      render(<PackageFormDraft {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('shows validation error when saving with empty name', () => {
      render(<PackageFormDraft {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Save Package' }));
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Package name is required.')).toBeInTheDocument();
    });

    it('does not call addPackage when name is empty', () => {
      render(<PackageFormDraft {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Save Package' }));
      expect(mockAddPackage).not.toHaveBeenCalled();
    });

    it('calls addPackage and onClose when form is valid', () => {
      render(<PackageFormDraft {...defaultProps} />);
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Package' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Package' }));
      expect(mockAddPackage).toHaveBeenCalledTimes(1);
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Package added' })
      );
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('clears name error when user starts typing', () => {
      render(<PackageFormDraft {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Save Package' }));
      expect(screen.getByText('Package name is required.')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'A' } });
      expect(screen.queryByText('Package name is required.')).not.toBeInTheDocument();
    });

    it('toggles bookable checkbox', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const checkbox = screen.getByLabelText('Package bookable') as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });

    it('shows bookable badge when isBookable is true', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const checkbox = screen.getByLabelText('Package bookable') as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(screen.getByTestId('badge')).toBeInTheDocument();
    });

    it('updates description textarea', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const descInput = screen.getByLabelText('Description') as HTMLTextAreaElement;
      fireEvent.change(descInput, { target: { value: 'Package description' } });
      expect(descInput.value).toBe('Package description');
    });

    it('changes duration via dropdown', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const durationDropdown = screen.getByLabelText('Duration');
      fireEvent.change(durationDropdown, { target: { value: '60' } });
      // name needed to save
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Package' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Package' }));
      expect(mockAddPackage).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 60 }));
    });

    it('changes lead count via dropdown', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const leadDropdown = screen.getByLabelText('Lead');
      fireEvent.change(leadDropdown, { target: { value: '0' } });
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Package' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Package' }));
      expect(mockAddPackage).toHaveBeenCalledWith(expect.objectContaining({ leadCount: 0 }));
    });

    it('changes support count via dropdown', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const supportDropdown = screen.getByLabelText('Support');
      fireEvent.change(supportDropdown, { target: { value: '3' } });
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Package' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Package' }));
      expect(mockAddPackage).toHaveBeenCalledWith(expect.objectContaining({ supportCount: 3 }));
    });

    it('saves additionalDiscount correctly', () => {
      render(<PackageFormDraft {...defaultProps} />);
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Package' } });
      fireEvent.change(screen.getByLabelText('Discount %'), { target: { value: '10' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Package' }));
      expect(mockAddPackage).toHaveBeenCalledWith(
        expect.objectContaining({ additionalDiscount: 10 })
      );
    });
  });

  describe('search and breakdown', () => {
    it('shows search results when query matches a catalog item', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const searchInput = screen.getByLabelText('Search catalog items');
      fireEvent.change(searchInput, { target: { value: 'radiograph' } });
      expect(screen.getByText('Radiographic Consultation')).toBeInTheDocument();
    });

    it('shows "No items found." when search matches nothing', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const searchInput = screen.getByLabelText('Search catalog items');
      fireEvent.change(searchInput, { target: { value: 'zzznomatch' } });
      expect(screen.getByText('No items found.')).toBeInTheDocument();
    });

    it('shows no dropdown when search is empty', () => {
      render(<PackageFormDraft {...defaultProps} />);
      expect(screen.queryByText('Radiographic Consultation')).not.toBeInTheDocument();
      expect(screen.queryByText('No items found.')).not.toBeInTheDocument();
    });

    it('adds a catalog item to breakdown when clicked', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const searchInput = screen.getByLabelText('Search catalog items');
      fireEvent.change(searchInput, { target: { value: 'syringe' } });
      fireEvent.click(screen.getByText('Syringe'));
      expect(screen.getByTestId('breakdown-table')).toBeInTheDocument();
      expect(
        screen.queryByText('Search above to add items to the package breakdown.')
      ).not.toBeInTheDocument();
    });

    it('clears search query after adding an item', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const searchInput = screen.getByLabelText('Search catalog items');
      fireEvent.change(searchInput, { target: { value: 'syringe' } });
      fireEvent.click(screen.getByText('Syringe'));
      expect((searchInput as HTMLInputElement).value).toBe('');
    });

    it('increments quantity when adding the same item twice', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const searchInput = screen.getByLabelText('Search catalog items');
      // Add Syringe once
      fireEvent.change(searchInput, { target: { value: 'syringe' } });
      const firstResult = screen.getAllByText('Syringe')[0];
      fireEvent.click(firstResult);
      // Add Syringe again — it's now in the breakdown table too, so click the dropdown result
      fireEvent.change(searchInput, { target: { value: 'syringe' } });
      const secondResult = screen.getAllByText('Syringe')[0];
      fireEvent.click(secondResult);
      // Should only have one breakdown item (quantity incremented, not duplicated)
      const breakdownItems = screen.getAllByTestId(/^breakdown-item-/);
      expect(breakdownItems).toHaveLength(1);
    });

    it('removes a breakdown item', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const searchInput = screen.getByLabelText('Search catalog items');
      fireEvent.change(searchInput, { target: { value: 'mri' } });
      fireEvent.click(screen.getByText('MRI Procedure'));
      expect(screen.getByTestId('breakdown-table')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Remove MRI Procedure' }));
      expect(screen.queryByTestId('breakdown-table')).not.toBeInTheDocument();
    });

    it('handles quantity change on breakdown item', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const searchInput = screen.getByLabelText('Search catalog items');
      fireEvent.change(searchInput, { target: { value: 'syringe' } });
      fireEvent.click(screen.getByText('Syringe'));
      fireEvent.click(screen.getByRole('button', { name: 'Change Qty' }));
      // No error thrown = state updated correctly
      expect(screen.getByTestId('breakdown-table')).toBeInTheDocument();
    });

    it('handles discount change on breakdown item', () => {
      render(<PackageFormDraft {...defaultProps} />);
      const searchInput = screen.getByLabelText('Search catalog items');
      fireEvent.change(searchInput, { target: { value: 'syringe' } });
      fireEvent.click(screen.getByText('Syringe'));
      fireEvent.click(screen.getByRole('button', { name: 'Change Discount' }));
      expect(screen.getByTestId('breakdown-table')).toBeInTheDocument();
    });

    it('shows active packages from store in search results', () => {
      const activePackage = {
        id: 'pkg-active-1',
        name: 'Wellness Pack',
        status: 'ACTIVE',
        breakdown: [],
      };
      setupStoreMock([activePackage]);
      render(<PackageFormDraft {...defaultProps} />);
      const searchInput = screen.getByLabelText('Search catalog items');
      fireEvent.change(searchInput, { target: { value: 'wellness' } });
      expect(screen.getByText('Wellness Pack')).toBeInTheDocument();
    });

    it('excludes the editPackage itself from the combined catalog', () => {
      setupStoreMock([{ id: 'pkg-edit-1', name: 'Self Package', status: 'ACTIVE', breakdown: [] }]);
      render(<PackageFormDraft {...defaultProps} editPackage={mockEditPackage} />);
      const searchInput = screen.getByLabelText('Search catalog items');
      fireEvent.change(searchInput, { target: { value: 'self' } });
      expect(screen.queryByText('Self Package')).not.toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('renders title with existing package name', () => {
      render(<PackageFormDraft {...defaultProps} editPackage={mockEditPackage} />);
      expect(screen.getByText('Wellness Package (draft)')).toBeInTheDocument();
    });

    it('pre-fills name field from editPackage', () => {
      render(<PackageFormDraft {...defaultProps} editPackage={mockEditPackage} />);
      expect(screen.getByLabelText('Name')).toHaveValue('Wellness Package');
    });

    it('shows Archive Package button in edit mode', () => {
      render(<PackageFormDraft {...defaultProps} editPackage={mockEditPackage} />);
      expect(screen.getByText('Archive Package')).toBeInTheDocument();
    });

    it('shows package code in title slot', () => {
      render(<PackageFormDraft {...defaultProps} editPackage={mockEditPackage} />);
      expect(screen.getByText('PKG-001')).toBeInTheDocument();
    });

    it('shows bookable badge when editPackage.isBookable is true', () => {
      render(<PackageFormDraft {...defaultProps} editPackage={mockEditPackage} />);
      expect(screen.getByTestId('badge')).toBeInTheDocument();
    });

    it('pre-fills breakdown from editPackage', () => {
      render(<PackageFormDraft {...defaultProps} editPackage={mockEditPackage} />);
      expect(screen.getByTestId('breakdown-table')).toBeInTheDocument();
    });

    it('calls updatePackage on save in edit mode', () => {
      render(<PackageFormDraft {...defaultProps} editPackage={mockEditPackage} />);
      fireEvent.click(screen.getByRole('button', { name: 'Save Package' }));
      expect(mockUpdatePackage).toHaveBeenCalledWith(
        'pkg-edit-1',
        expect.objectContaining({ name: 'Wellness Package' })
      );
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Package updated' })
      );
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls archivePackage and onClose when Archive is clicked', () => {
      render(<PackageFormDraft {...defaultProps} editPackage={mockEditPackage} />);
      fireEvent.click(screen.getByText('Archive Package'));
      expect(mockArchivePackage).toHaveBeenCalledWith('pkg-edit-1');
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Package archived' })
      );
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('shows "Package (draft)" when editPackage name is empty', () => {
      render(<PackageFormDraft {...defaultProps} editPackage={{ ...mockEditPackage, name: '' }} />);
      expect(screen.getByText('Package (draft)')).toBeInTheDocument();
    });

    it('does not show bookable badge when editPackage.isBookable is false', () => {
      render(
        <PackageFormDraft
          {...defaultProps}
          editPackage={{ ...mockEditPackage, isBookable: false }}
        />
      );
      expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
    });

    it('does not show code span when editPackage.code is missing', () => {
      const packageWithoutCode = { ...mockEditPackage, code: undefined };
      render(<PackageFormDraft {...defaultProps} editPackage={packageWithoutCode as any} />);
      expect(screen.queryByText('PKG-001')).not.toBeInTheDocument();
    });
  });
});
