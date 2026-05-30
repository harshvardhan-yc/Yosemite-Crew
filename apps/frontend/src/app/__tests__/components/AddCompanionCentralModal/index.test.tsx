import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Service mocks ─────────────────────────────────────────────────────────────
const mockSearchParent = jest.fn();
const mockCreateCompanion = jest.fn();
const mockCreateParent = jest.fn();
const mockGetCompanionForParent = jest.fn();
const mockLinkCompanion = jest.fn();
const mockUpdateCompanion = jest.fn();
const mockUpdateParent = jest.fn();

jest.mock('@/app/features/companions/services/companionService', () => ({
  searchParent: (...args: any[]) => mockSearchParent(...args),
  createCompanion: (...args: any[]) => mockCreateCompanion(...args),
  createParent: (...args: any[]) => mockCreateParent(...args),
  getCompanionForParent: (...args: any[]) => mockGetCompanionForParent(...args),
  linkCompanion: (...args: any[]) => mockLinkCompanion(...args),
  updateCompanion: (...args: any[]) => mockUpdateCompanion(...args),
  updateParent: (...args: any[]) => mockUpdateParent(...args),
}));

const mockFetchSpeciesCodeEntries = jest.fn().mockResolvedValue([]);
const mockFetchBreedCodeEntries = jest.fn().mockResolvedValue([]);

jest.mock('@/app/features/companions/services/codeEntriesService', () => ({
  fetchSpeciesCodeEntries: (...args: any[]) => mockFetchSpeciesCodeEntries(...args),
  fetchBreedCodeEntries: (...args: any[]) => mockFetchBreedCodeEntries(...args),
}));

const mockNotify = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

const mockCompanionsParents: any[] = [];
jest.mock('@/app/hooks/useCompanion', () => ({
  useCompanionsParentsForPrimaryOrg: jest.fn(() => mockCompanionsParents),
}));

const mockRouterPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// ─── UI component mocks ───────────────────────────────────────────────────────

jest.mock(
  '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell',
  () => ({
    __esModule: true,
    default: ({ showModal, children, title, canClose, setShowModal }: any) => {
      if (!showModal) return null;
      return (
        <div data-testid="modal-shell">
          <h2>{title}</h2>
          <button
            type="button"
            aria-label="Close modal"
            onClick={() => {
              if (canClose && !canClose()) return;
              setShowModal(false);
            }}
          >
            Close
          </button>
          {children}
        </div>
      );
    },
  })
);

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="center-modal">{children}</div> : null,
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, onSelect, defaultOption, error }: any) => (
    <div>
      <select
        aria-label={placeholder}
        value={defaultOption ?? ''}
        onChange={(e) => {
          const opt = (options as any[]).find((o: any) => o.value === e.target.value);
          if (opt) onSelect(opt);
        }}
      >
        {(options as any[]).map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error, intype, inname }: any) => (
    <div>
      <input
        aria-label={inlabel}
        type={intype ?? 'text'}
        name={inname}
        value={value ?? ''}
        onChange={onChange}
      />
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ placeholder }: any) => (
    <input aria-label={placeholder ?? 'date'} type="text" readOnly />
  ),
}));

jest.mock('@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <div>
      <input aria-label={inlabel} value={value ?? ''} onChange={onChange} />
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormDesc/FormDesc', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <textarea aria-label={inlabel} value={value ?? ''} onChange={onChange} />
  ),
}));

jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="accordion">
      <span>{title}</span>
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, type, icon }: any) => (
    <button type={type ?? 'button'} onClick={onClick}>
      {icon}
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, href }: any) => (
    <a href={href ?? '#'} role="button" onClick={onClick}>
      {text}
    </a>
  ),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="next-image" role="img" aria-label={alt} />,
}));

jest.mock('react-icons/io5', () => ({
  IoClose: () => <span data-testid="icon-io-close" />,
  IoPencilOutline: () => <span data-testid="icon-io-pencil" />,
  IoInformationCircleOutline: () => <span data-testid="icon-io-info" />,
}));

jest.mock('react-icons/io', () => ({
  IoIosWarning: () => <span data-testid="icon-warning" />,
}));

jest.mock('react-icons/fi', () => ({
  FiPlus: () => <span data-testid="icon-fi-plus" />,
  FiCheck: () => <span data-testid="icon-fi-check" />,
}));

jest.mock('react-icons/md', () => ({
  MdPets: () => <span data-testid="icon-md-pets" />,
}));

jest.mock('react-icons/fa', () => ({
  FaUser: () => <span data-testid="icon-fa-user" />,
}));

jest.mock('@/app/hooks/useDropdown', () => ({
  useFilteredOptions: (options: any[], value: string) => {
    if (!value) return [];
    return options.filter((o: any) => o.label.toLowerCase().includes(value.toLowerCase()));
  },
}));

// Mock InputWithDropdown internals — the component is defined inside the module so we need
// to intercept via the module boundary. We mock createPortal to prevent portal errors in tests.
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: jest.fn(() => '/mock-image.png'),
}));

jest.mock('@/app/lib/companionName', () => ({
  formatCompanionNameWithOwnerLastName: jest.fn(
    (name: string, parent: any) => `${name} (${parent?.lastName ?? ''})`
  ),
}));

jest.mock('@/app/lib/companionHistoryRoute', () => ({
  buildCompanionOverviewHref: jest.fn(() => '/companions/mock'),
}));

jest.mock('@/app/lib/date', () => ({
  formatDisplayDate: jest.fn(() => '01/01/2020'),
  getAgeInYears: jest.fn(() => 4),
}));

jest.mock('@/app/ui/tables/tableUtils', () => ({
  getCompanionStatusStyle: jest.fn(() => ({ background: 'green', color: 'white' })),
}));

jest.mock('@/app/lib/validators', () => ({
  getEmailValidationError: jest.fn((email: string) => {
    if (!email) return 'Email is required';
    if (!email.includes('@')) return 'Enter a valid email address';
    return null;
  }),
  normalizeEmail: jest.fn((email: string) => email.toLowerCase().trim()),
  validatePhone: jest.fn((phone: string) => phone.length >= 10),
  toTitleCase: jest.fn((s: string) => s.charAt(0).toUpperCase() + s.slice(1)),
}));

// ─── Import component AFTER mocks ─────────────────────────────────────────────
import AddCompanionCentralModal from '@/app/features/companions/components/AddCompanionCentralModal/index';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockViewCompanion = {
  companion: {
    id: 'comp-1',
    organisationId: 'org-1',
    parentId: 'parent-1',
    name: 'Buddy',
    type: 'dog' as const,
    speciesCode: 'K9',
    breed: 'Labrador',
    breedCode: 'LAB',
    dateOfBirth: new Date('2020-01-01'),
    gender: 'male' as const,
    currentWeight: 30,
    colour: 'brown',
    allergy: '',
    bloodGroup: '',
    isneutered: false,
    microchipNumber: '',
    passportNumber: '',
    isInsured: false,
    insurance: undefined,
    countryOfOrigin: '',
    source: 'unknown' as const,
    status: 'active' as const,
    photoUrl: '',
  },
  parent: {
    id: 'parent-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    birthDate: undefined,
    phoneNumber: '+12025551234',
    address: {
      addressLine: '123 Main St',
      country: 'US',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      latitude: undefined,
      longitude: undefined,
    },
    createdFrom: 'pms' as const,
  },
};

const defaultProps = {
  showModal: true,
  setShowModal: jest.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AddCompanionCentralModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCompanionForParent.mockResolvedValue([]);
    mockSearchParent.mockResolvedValue([]);
    mockFetchSpeciesCodeEntries.mockResolvedValue([]);
    mockFetchBreedCodeEntries.mockResolvedValue([
      { display: 'Poodle', code: 'PDL', meta: { speciesCode: 'K9' } },
      { display: 'Labrador', code: 'LAB', meta: { speciesCode: 'K9' } },
    ]);
  });

  afterEach(async () => {
    // Flush all pending state updates and promises to prevent act() warnings
    // from leaking into subsequent tests.
    await act(async () => {
      await Promise.resolve();
    });
  });

  // ── 1. Render ───────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders nothing when showModal is false', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} showModal={false} />);
      });
      expect(screen.queryByTestId('modal-shell')).not.toBeInTheDocument();
    });

    it('renders form with "New Patient / Client" title when showModal=true and no viewCompanion', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
      expect(screen.getByText('New Patient / Client')).toBeInTheDocument();
    });

    it('renders patient and client section headings in create mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      expect(screen.getByText('Patient Details')).toBeInTheDocument();
      expect(screen.getByText('Client Details')).toBeInTheDocument();
    });

    it('renders Save Patient Info button in create mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      expect(screen.getByRole('button', { name: /save patient info/i })).toBeInTheDocument();
    });
  });

  // ── 2. View mode ────────────────────────────────────────────────────────────

  describe('view mode', () => {
    it('renders companion name and client details when viewCompanion is provided', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });
      // The modal shell title shows companion name via formatCompanionNameWithOwnerLastName
      expect(screen.getByRole('heading', { name: /buddy/i })).toBeInTheDocument();
      // Client details section
      expect(screen.getByText('Client Details')).toBeInTheDocument();
    });

    it('shows Edit button in view mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('clicking Edit switches to edit mode showing "Edit Patient / Client" title', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });
      const editBtn = screen.getByRole('button', { name: /edit/i });
      await act(async () => {
        fireEvent.click(editBtn);
      });
      expect(screen.getByText('Edit Patient / Client')).toBeInTheDocument();
    });

    it('shows Back to details button in edit mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });
      expect(screen.getByRole('button', { name: /← back to details/i })).toBeInTheDocument();
    });

    it('clicking Back to details from edit reverts to view mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });
      // Verify edit mode is active
      expect(screen.getByText('Edit Patient / Client')).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /← back to details/i }));
      });
      // Returns to view mode — modal shell heading shows companion title
      expect(screen.getByRole('heading', { name: /buddy/i })).toBeInTheDocument();
    });

    it('shows patient info rows in view mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });
      expect(screen.getByText('Patient Details')).toBeInTheDocument();
      expect(screen.getByText('Labrador')).toBeInTheDocument();
    });
  });

  // ── 3. Create mode validation ───────────────────────────────────────────────

  describe('create mode validation', () => {
    it('shows validation errors when saving without required fields', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });
      // Check that multiple validation errors are shown across the form.
      // FormInput mock renders errors as role="alert"; InputWithDropdown renders as plain <span>.
      // Use getAllByRole('alert') for FormInput errors and getByText for others.
      expect(screen.getByText('Last name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Number is required')).toBeInTheDocument();
      expect(screen.getByText('Address is required')).toBeInTheDocument();
    });

    it('shows email validation error for missing email', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });

    it('shows phone number required error when no phone is entered', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });
      expect(screen.getByText('Number is required')).toBeInTheDocument();
    });

    it('shows address required error when address is empty', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });
      expect(screen.getByText('Address is required')).toBeInTheDocument();
    });

    it('does not call createCompanion when validation fails', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });
      expect(mockCreateCompanion).not.toHaveBeenCalled();
    });
  });

  // ── 4. Create mode happy path ───────────────────────────────────────────────

  describe('create mode happy path', () => {
    const fillRequiredFields = async () => {
      // companion name — uses InputWithDropdown, accessible via aria-label
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Max' } });
      // species — LabelDropdown select
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dog' } });
      });
      // Wait for breed options to load (async fetchBreedCodeEntries)
      await waitFor(() => {
        const breedSelect = screen.getByLabelText('Breed') as HTMLSelectElement;
        expect(breedSelect.options.length).toBeGreaterThan(0);
      });
      // breed
      fireEvent.change(screen.getByLabelText('Breed'), { target: { value: 'Poodle' } });
      // parent first name — InputWithDropdown
      fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Jane' } });
      // parent last name
      fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Smith' } });
      // email
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
      // phone
      fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '2025551234' } });
      // address
      fireEvent.change(screen.getByLabelText('Address'), { target: { value: '1 Test Ave' } });
      // city
      fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Springfield' } });
      // state
      fireEvent.change(screen.getByLabelText('State / Province'), { target: { value: 'IL' } });
      // postal code
      fireEvent.change(screen.getByLabelText('ZIP'), { target: { value: '62701' } });
    };

    it('calls createParent and createCompanion on successful submission', async () => {
      mockCreateParent.mockResolvedValue('new-parent-id');
      mockCreateCompanion.mockResolvedValue({ id: 'new-comp-id', name: 'Max' });

      const setShowModal = jest.fn();
      const onCompanionCreated = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal
            showModal={true}
            setShowModal={setShowModal}
            onCompanionCreated={onCompanionCreated}
          />
        );
      });

      await act(async () => {
        await fillRequiredFields();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      await waitFor(() => {
        expect(mockCreateParent).toHaveBeenCalled();
        expect(mockCreateCompanion).toHaveBeenCalled();
      });
    });

    it('calls onCompanionCreated with companion id and setShowModal(false) after creation', async () => {
      mockCreateParent.mockResolvedValue('new-parent-id');
      mockCreateCompanion.mockResolvedValue({ id: 'new-comp-id', name: 'Max' });

      const setShowModal = jest.fn();
      const onCompanionCreated = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal
            showModal={true}
            setShowModal={setShowModal}
            onCompanionCreated={onCompanionCreated}
          />
        );
      });

      await act(async () => {
        await fillRequiredFields();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      await waitFor(() => {
        expect(onCompanionCreated).toHaveBeenCalledWith('new-comp-id');
        expect(setShowModal).toHaveBeenCalledWith(false);
      });
    });

    it('shows success notification after creation', async () => {
      mockCreateParent.mockResolvedValue('new-parent-id');
      mockCreateCompanion.mockResolvedValue({ id: 'new-comp-id', name: 'Max' });

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        await fillRequiredFields();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          'success',
          expect.objectContaining({ title: 'Companion saved' })
        );
      });
    });
  });

  // ── 5. Fasttrack mode ───────────────────────────────────────────────────────

  describe('fasttrack mode', () => {
    it('renders modal in fasttrack mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} formMode="fasttrack" />);
      });
      expect(screen.getByText('New Patient / Client')).toBeInTheDocument();
    });

    it('does not show insurance validation errors in fasttrack mode even when isInsured', async () => {
      // In fasttrack, insurance validation is skipped even if companion is insured
      mockCreateParent.mockResolvedValue('parent-ft');
      mockCreateCompanion.mockResolvedValue({ id: 'comp-ft', name: 'Bella' });

      const setShowModal = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal
            showModal={true}
            setShowModal={setShowModal}
            formMode="fasttrack"
          />
        );
      });

      // Fill required fields but leave insurance blank
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bella' } });
      });
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dog' } });
      });
      await waitFor(() => {
        const breedSelect = screen.getByLabelText('Breed') as HTMLSelectElement;
        expect(breedSelect.options.length).toBeGreaterThan(0);
      });
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Breed'), { target: { value: 'Poodle' } });
        fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Alice' } });
        fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Brown' } });
        fireEvent.change(screen.getByLabelText('Email'), {
          target: { value: 'alice@example.com' },
        });
        fireEvent.change(screen.getByLabelText('Phone number'), {
          target: { value: '2025551234' },
        });
        fireEvent.change(screen.getByLabelText('Address'), { target: { value: '5 Oak St' } });
        fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Portland' } });
        fireEvent.change(screen.getByLabelText('State / Province'), { target: { value: 'OR' } });
        fireEvent.change(screen.getByLabelText('ZIP'), { target: { value: '97201' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      // No insurance errors in fasttrack
      await waitFor(() => {
        expect(screen.queryByText('Company name is required')).not.toBeInTheDocument();
        expect(screen.queryByText('Policy number is required')).not.toBeInTheDocument();
      });
    });
  });

  // ── 6. Discard changes confirmation ─────────────────────────────────────────

  describe('discard changes confirmation', () => {
    it('shows discard confirm modal when closing with unsaved changes', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      // Type companion name to make form dirty
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dirty' } });
      });

      // Click the shell close button which calls canClose
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
      });

      expect(screen.getByTestId('center-modal')).toBeInTheDocument();
      expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    });

    it('clicking "Keep editing" closes confirm without dismissing main modal', async () => {
      const setShowModal = jest.fn();

      await act(async () => {
        render(<AddCompanionCentralModal showModal={true} setShowModal={setShowModal} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dirty' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
      });

      const keepEditing = screen.getByRole('button', { name: /keep editing/i });
      await act(async () => {
        fireEvent.click(keepEditing);
      });

      expect(setShowModal).not.toHaveBeenCalled();
      expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
    });

    it('clicking "Discard" calls setShowModal(false)', async () => {
      const setShowModal = jest.fn();

      await act(async () => {
        render(<AddCompanionCentralModal showModal={true} setShowModal={setShowModal} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dirty' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
      });

      const discardBtn = screen.getByRole('button', { name: /^discard$/i });
      await act(async () => {
        fireEvent.click(discardBtn);
      });

      expect(setShowModal).toHaveBeenCalledWith(false);
    });

    it('closes cleanly with no changes (no discard dialog shown)', async () => {
      const setShowModal = jest.fn();

      await act(async () => {
        render(<AddCompanionCentralModal showModal={true} setShowModal={setShowModal} />);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
      });

      expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
      expect(setShowModal).toHaveBeenCalledWith(false);
    });
  });

  // ── 7. onGoToAppointment ────────────────────────────────────────────────────

  describe('onGoToAppointment', () => {
    it('renders "← Go to Appointment" button when onGoToAppointment is provided in create mode', async () => {
      const onGoToAppointment = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal {...defaultProps} onGoToAppointment={onGoToAppointment} />
        );
      });

      expect(screen.getByRole('button', { name: /go to appointment/i })).toBeInTheDocument();
    });

    it('clicking "← Go to Appointment" with no changes calls onGoToAppointment', async () => {
      const onGoToAppointment = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal {...defaultProps} onGoToAppointment={onGoToAppointment} />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /go to appointment/i }));
      });

      expect(onGoToAppointment).toHaveBeenCalled();
    });

    it('clicking "← Go to Appointment" with unsaved changes shows discard confirm', async () => {
      const onGoToAppointment = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal {...defaultProps} onGoToAppointment={onGoToAppointment} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dirty' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /go to appointment/i }));
      });

      expect(screen.getByTestId('center-modal')).toBeInTheDocument();
      expect(onGoToAppointment).not.toHaveBeenCalled();
    });

    it('after discarding, calls onGoToAppointment instead of setShowModal(false)', async () => {
      const setShowModal = jest.fn();
      const onGoToAppointment = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal
            showModal={true}
            setShowModal={setShowModal}
            onGoToAppointment={onGoToAppointment}
          />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dirty' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /go to appointment/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^discard$/i }));
      });

      expect(onGoToAppointment).toHaveBeenCalled();
      expect(setShowModal).not.toHaveBeenCalled();
    });

    it('does not show "← Go to Appointment" in view mode', async () => {
      const onGoToAppointment = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal
            {...defaultProps}
            viewCompanion={mockViewCompanion}
            onGoToAppointment={onGoToAppointment}
          />
        );
      });

      expect(screen.queryByRole('button', { name: /go to appointment/i })).not.toBeInTheDocument();
    });
  });

  // ── 8. Alert add/remove ─────────────────────────────────────────────────────

  describe('alert add/remove', () => {
    it('Add alert button is disabled when alert input is empty', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      const addAlertBtn = screen.getByRole('button', { name: /add alert/i });
      expect(addAlertBtn).toBeDisabled();
    });

    it('Add alert button is enabled when alert input has text', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      const alertInput = screen.getByLabelText('e.g. Diabetic, May bite…');
      await act(async () => {
        fireEvent.change(alertInput, { target: { value: 'Diabetic' } });
      });

      expect(screen.getByRole('button', { name: /add alert/i })).not.toBeDisabled();
    });

    it('adds an alert chip when Add alert is clicked', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      const alertInput = screen.getByLabelText('e.g. Diabetic, May bite…');
      await act(async () => {
        fireEvent.change(alertInput, { target: { value: 'Diabetic' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /add alert/i }));
      });

      expect(screen.getByText('Diabetic')).toBeInTheDocument();
    });

    it('clears alert input after adding an alert', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      const alertInput = screen.getByLabelText('e.g. Diabetic, May bite…');
      await act(async () => {
        fireEvent.change(alertInput, { target: { value: 'Diabetic' } });
        fireEvent.click(screen.getByRole('button', { name: /add alert/i }));
      });

      expect(alertInput).toHaveValue('');
    });

    it('removes an alert chip when Remove is clicked', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      const alertInput = screen.getByLabelText('e.g. Diabetic, May bite…');
      await act(async () => {
        fireEvent.change(alertInput, { target: { value: 'Diabetic' } });
        fireEvent.click(screen.getByRole('button', { name: /add alert/i }));
      });

      expect(screen.getByText('Diabetic')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /remove alert diabetic/i }));
      });

      expect(screen.queryByText('Diabetic')).not.toBeInTheDocument();
    });

    it('can add multiple alerts', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      const alertInput = screen.getByLabelText('e.g. Diabetic, May bite…');

      await act(async () => {
        fireEvent.change(alertInput, { target: { value: 'Alert 1' } });
        fireEvent.click(screen.getByRole('button', { name: /add alert/i }));
      });

      await act(async () => {
        fireEvent.change(alertInput, { target: { value: 'Alert 2' } });
        fireEvent.click(screen.getByRole('button', { name: /add alert/i }));
      });

      expect(screen.getByText('Alert 1')).toBeInTheDocument();
      expect(screen.getByText('Alert 2')).toBeInTheDocument();
    });
  });

  // ── 9. Status change (view mode) ────────────────────────────────────────────

  describe('status change in view mode', () => {
    it('shows status dropdown when canEditCompanionStatus=true', async () => {
      await act(async () => {
        render(
          <AddCompanionCentralModal
            {...defaultProps}
            viewCompanion={mockViewCompanion}
            canEditCompanionStatus={true}
          />
        );
      });

      expect(screen.getByLabelText('Change status')).toBeInTheDocument();
    });

    it('does not show status dropdown when canEditCompanionStatus=false', async () => {
      await act(async () => {
        render(
          <AddCompanionCentralModal
            {...defaultProps}
            viewCompanion={mockViewCompanion}
            canEditCompanionStatus={false}
          />
        );
      });

      expect(screen.queryByLabelText('Change status')).not.toBeInTheDocument();
    });

    it('calls updateCompanion when a new status is selected', async () => {
      mockUpdateCompanion.mockResolvedValue(undefined);

      await act(async () => {
        render(
          <AddCompanionCentralModal
            {...defaultProps}
            viewCompanion={mockViewCompanion}
            canEditCompanionStatus={true}
          />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Change status'), { target: { value: 'inactive' } });
      });

      await waitFor(() => {
        expect(mockUpdateCompanion).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'inactive' })
        );
      });
    });

    it('shows success notification after status update', async () => {
      mockUpdateCompanion.mockResolvedValue(undefined);

      await act(async () => {
        render(
          <AddCompanionCentralModal
            {...defaultProps}
            viewCompanion={mockViewCompanion}
            canEditCompanionStatus={true}
          />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Change status'), { target: { value: 'inactive' } });
      });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          'success',
          expect.objectContaining({ title: 'Status updated' })
        );
      });
    });

    it('shows error notification when updateCompanion throws', async () => {
      mockUpdateCompanion.mockRejectedValue(new Error('API error'));

      await act(async () => {
        render(
          <AddCompanionCentralModal
            {...defaultProps}
            viewCompanion={mockViewCompanion}
            canEditCompanionStatus={true}
          />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Change status'), { target: { value: 'archived' } });
      });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({ title: 'Failed to update status' })
        );
      });
    });
  });

  // ── 10. Error notification ──────────────────────────────────────────────────

  describe('error notification on creation failure', () => {
    const fillRequiredFieldsInner = async () => {
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Max' } });
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dog' } });
      });
      await waitFor(() => {
        const breedSelect = screen.getByLabelText('Breed') as HTMLSelectElement;
        expect(breedSelect.options.length).toBeGreaterThan(0);
      });
      fireEvent.change(screen.getByLabelText('Breed'), { target: { value: 'Poodle' } });
      fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Jane' } });
      fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Smith' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
      fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '2025551234' } });
      fireEvent.change(screen.getByLabelText('Address'), { target: { value: '1 Test Ave' } });
      fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Springfield' } });
      fireEvent.change(screen.getByLabelText('State / Province'), { target: { value: 'IL' } });
      fireEvent.change(screen.getByLabelText('ZIP'), { target: { value: '62701' } });
    };

    it('shows error notification when createCompanion throws', async () => {
      mockCreateParent.mockResolvedValue('p-id');
      mockCreateCompanion.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await fillRequiredFieldsInner();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({ title: 'Unable to save' })
        );
      });
    });

    it('does not call setShowModal(false) when creation fails', async () => {
      mockCreateParent.mockResolvedValue('p-id');
      mockCreateCompanion.mockRejectedValue(new Error('Fail'));

      const setShowModal = jest.fn();

      await act(async () => {
        render(<AddCompanionCentralModal showModal={true} setShowModal={setShowModal} />);
      });

      await fillRequiredFieldsInner();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith('error', expect.anything());
      });

      expect(setShowModal).not.toHaveBeenCalled();
    });
  });

  // ── 11. Edit mode save ──────────────────────────────────────────────────────

  describe('edit mode save', () => {
    it('calls updateCompanion and updateParent on Save changes', async () => {
      mockUpdateCompanion.mockResolvedValue(undefined);
      mockUpdateParent.mockResolvedValue(undefined);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });

      // Switch to edit mode
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
      });

      await waitFor(() => {
        expect(mockUpdateCompanion).toHaveBeenCalled();
        expect(mockUpdateParent).toHaveBeenCalled();
      });
    });

    it('shows success notification after edit save', async () => {
      mockUpdateCompanion.mockResolvedValue(undefined);
      mockUpdateParent.mockResolvedValue(undefined);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
      });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          'success',
          expect.objectContaining({ title: 'Companion updated' })
        );
      });
    });

    it('returns to view mode after successful edit save', async () => {
      mockUpdateCompanion.mockResolvedValue(undefined);
      mockUpdateParent.mockResolvedValue(undefined);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
      });

      await waitFor(() => {
        // View mode shows the companion title as a heading
        expect(screen.getByRole('heading', { name: /buddy/i })).toBeInTheDocument();
      });
    });
  });

  // ── 12. Modal resets on close ───────────────────────────────────────────────

  describe('modal state resets', () => {
    it('clears form fields when showModal changes from true to false', async () => {
      const { rerender } = render(
        <AddCompanionCentralModal showModal={true} setShowModal={jest.fn()} />
      );

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Maximus' } });
      });

      await act(async () => {
        rerender(<AddCompanionCentralModal showModal={false} setShowModal={jest.fn()} />);
      });

      // Modal hidden — no crash
      expect(screen.queryByTestId('modal-shell')).not.toBeInTheDocument();

      await act(async () => {
        rerender(<AddCompanionCentralModal showModal={true} setShowModal={jest.fn()} />);
      });

      // Name should be cleared
      expect(screen.getByLabelText('Name')).toHaveValue('');
    });
  });
});
