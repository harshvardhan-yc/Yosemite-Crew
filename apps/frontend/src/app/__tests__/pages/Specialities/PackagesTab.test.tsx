import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PackagesTab from '@/app/features/organization/pages/Specialities/PackagesTab';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useNotify } from '@/app/hooks/useNotify';

// --- Mocks ---

jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: () => 'USD',
}));

jest.mock('@/app/lib/money', () => ({
  formatMoney: (amount: number) => `$ ${amount.toFixed(2)}`,
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (fn: any) => fn,
}));

jest.mock('@/app/features/organization/pages/Specialities/PackageFormDraft', () => ({
  __esModule: true,
  default: ({ onClose, editPackage }: any) => (
    <div data-testid={editPackage ? `edit-draft-${editPackage.id}` : 'add-draft'}>
      <button type="button" onClick={onClose}>
        Close Draft
      </button>
    </div>
  ),
}));

jest.mock('@/app/features/organization/pages/Specialities/PackageBreakdownTable', () => ({
  __esModule: true,
  default: () => <div data-testid="breakdown-table" />,
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="center-modal">{children}</div> : null,
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title, onClose }: any) => (
    <div>
      <span>{title}</span>
      <button type="button" onClick={onClose}>
        Modal Close
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Secondary', () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Delete', () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/Badge', () => ({
  __esModule: true,
  default: ({ children }: any) => <span>{children}</span>,
}));

jest.mock('@/app/ui/primitives/SectionContainer/SectionContainer', () => ({
  __esModule: true,
  default: ({ children, title, titleSlot }: any) => (
    <div>
      <span>{title}</span>
      {titleSlot}
      {children}
    </div>
  ),
}));

jest.mock('@/app/features/organization/services/revampMockData', () => ({
  computePackageTotals: jest.fn(() => ({ totalCost: 100, grossTotal: 120 })),
}));

jest.mock('react-icons/ri', () => ({
  RiEdit2Line: () => <span data-testid="edit-icon" />,
}));

jest.mock('react-icons/md', () => ({
  MdDeleteForever: () => <span data-testid="delete-icon" />,
}));

jest.mock('react-icons/io5', () => ({
  IoChevronDown: () => <span data-testid="chevron-icon" />,
}));

jest.mock('react-icons/ai', () => ({
  AiOutlineInfoCircle: () => <span data-testid="info-icon" />,
  AiOutlinePlus: () => <span data-testid="plus-icon" />,
}));

// --- Test Data ---

const mockPackage = {
  id: 'pkg-1',
  name: 'Wellness Package',
  code: 'WEL001',
  specialityId: 'spec-1',
  status: 'ACTIVE' as const,
  isBookable: true,
  description: 'Annual wellness check',
  durationMinutes: 60,
  additionalDiscount: 10,
  breakdown: [],
};

const mockPackageWithBreakdown = {
  ...mockPackage,
  id: 'pkg-2',
  name: 'Premium Package',
  breakdown: [{ id: 'b1', name: 'Lab Test', price: 50, quantity: 1, discount: 0 }],
};

describe('PackagesTab', () => {
  const mockDeletePackage = jest.fn();
  const mockNotify = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotify as jest.Mock).mockReturnValue({ notify: mockNotify });
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        packages: [mockPackage, mockPackageWithBreakdown],
        deletePackage: mockDeletePackage,
      };
      return selector(state);
    });
  });

  // --- Section 1: Rendering ---

  it('renders package cards for active packages in the speciality', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    expect(screen.getByText('Wellness Package')).toBeInTheDocument();
    expect(screen.getByText('Premium Package')).toBeInTheDocument();
  });

  it('renders "Click to add package" button when draft is not open', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    expect(screen.getByText('Click to add package')).toBeInTheDocument();
  });

  it('shows empty state message when no packages exist', () => {
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ packages: [], deletePackage: mockDeletePackage })
    );
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    expect(screen.getByText(/haven.*t added any packages yet/i)).toBeInTheDocument();
  });

  it('does not show empty state when packages exist', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    expect(screen.queryByText(/haven.*t added any packages yet/i)).not.toBeInTheDocument();
  });

  it('only renders packages matching the specialityId and ACTIVE status', () => {
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        packages: [
          mockPackage,
          { ...mockPackage, id: 'pkg-other', specialityId: 'spec-other' },
          { ...mockPackage, id: 'pkg-hidden', status: 'ARCHIVED' as const },
        ],
        deletePackage: mockDeletePackage,
      };
      return selector(state);
    });
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    expect(screen.getAllByText('Wellness Package')).toHaveLength(1);
  });

  // --- Section 2: Add flow ---

  it('opens add draft at bottom when "Click to add package" is clicked', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    fireEvent.click(screen.getByText('Click to add package'));
    expect(screen.getByTestId('add-draft')).toBeInTheDocument();
    // Add button should be hidden while draft is open
    expect(screen.queryByText('Click to add package')).not.toBeInTheDocument();
  });

  it('closes the add draft when Close Draft is clicked', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    fireEvent.click(screen.getByText('Click to add package'));
    fireEvent.click(screen.getByText('Close Draft'));
    expect(screen.queryByTestId('add-draft')).not.toBeInTheDocument();
    expect(screen.getByText('Click to add package')).toBeInTheDocument();
  });

  // --- Section 3: Edit flow ---

  it('opens edit draft when edit button for a package is clicked', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    const editButtons = screen.getAllByRole('button', { name: /Edit Wellness Package/i });
    fireEvent.click(editButtons[0]);
    expect(screen.getByTestId('edit-draft-pkg-1')).toBeInTheDocument();
  });

  it('closes edit draft when Close Draft is clicked', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    const editButtons = screen.getAllByRole('button', { name: /Edit Wellness Package/i });
    fireEvent.click(editButtons[0]);
    fireEvent.click(screen.getByText('Close Draft'));
    expect(screen.queryByTestId('edit-draft-pkg-1')).not.toBeInTheDocument();
  });

  // --- Section 4: Delete flow ---

  it('shows delete confirmation modal when delete button is clicked', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    const deleteButtons = screen.getAllByRole('button', { name: /Delete Wellness Package/i });
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByTestId('center-modal')).toBeInTheDocument();
    expect(screen.getByText('Delete package')).toBeInTheDocument();
    expect(screen.getAllByText(/Wellness Package/).length).toBeGreaterThanOrEqual(1);
  });

  it('cancels delete when Cancel is clicked', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    const deleteButtons = screen.getAllByRole('button', { name: /Delete Wellness Package/i });
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
    expect(mockDeletePackage).not.toHaveBeenCalled();
  });

  it('confirms delete and calls deletePackage + notify on confirm', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    const deleteButtons = screen.getAllByRole('button', { name: /Delete Wellness Package/i });
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mockDeletePackage).toHaveBeenCalledWith('pkg-1');
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Package deleted' })
    );
    expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
  });

  it('closes delete modal via modal header close button', () => {
    render(<PackagesTab specialityId="spec-1" organisationId="org-1" />);
    const deleteButtons = screen.getAllByRole('button', { name: /Delete Wellness Package/i });
    fireEvent.click(deleteButtons[0]);
    // Modal close button (from ModalHeader mock)
    fireEvent.click(screen.getByRole('button', { name: 'Modal Close' }));
    expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
  });
});
