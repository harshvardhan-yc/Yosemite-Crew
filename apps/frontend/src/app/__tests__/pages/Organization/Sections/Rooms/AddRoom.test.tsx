import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddRoom from '@/app/features/organization/pages/Organization/Sections/Rooms/AddRoom';

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input value={value} onChange={onChange} aria-label={inlabel} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, defaultOption }: any) => (
    <button type="button" onClick={() => onSelect({ value: defaultOption || 'CONSULTATION' })}>
      {placeholder}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, value = [], onChange }: any) => (
    <button
      type="button"
      aria-label={placeholder}
      onClick={() => onChange?.(placeholder === 'Species' ? ['CANINE', 'FELINE'] : value)}
    >
      {placeholder}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Timepicker', () => ({
  __esModule: true,
  default: ({ label, value, onChange }: any) => (
    <label>
      {label}
      <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => [],
}));

jest.mock('@/app/hooks/useSpecialities', () => ({
  useSpecialitiesForPrimaryOrg: () => [],
}));

jest.mock('@/app/features/organization/services/roomService', () => ({
  createRoom: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: jest.fn() }),
}));

const roomService = jest.requireMock('@/app/features/organization/services/roomService');

describe('AddRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows validation errors', () => {
    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByText('Add room'));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('creates a room', async () => {
    roomService.createRoom.mockResolvedValue({});
    const setShowModal = jest.fn();

    render(<AddRoom showModal setShowModal={setShowModal} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Room A' },
    });
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalled();
    });
    expect(roomService.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Room A',
        unitCount: 0,
        units: [],
        equipment: ['Oxygen Tank', 'Dental Unit', 'Isolation unit'],
      })
    );
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('adds custom equipment to the created room payload', async () => {
    roomService.createRoom.mockResolvedValue({});

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Imaging Room' },
    });
    fireEvent.change(screen.getByLabelText('Add equipment name'), {
      target: { value: 'MRI Scanner' },
    });
    fireEvent.click(screen.getByLabelText('Add custom equipment'));
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          equipment: expect.arrayContaining(['MRI Scanner']),
        })
      );
    });
  });

  it('creates room units from configured unit types', async () => {
    roomService.createRoom.mockResolvedValue({});

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Ward A' },
    });
    fireEvent.click(screen.getByLabelText('Add unit type'));
    fireEvent.change(screen.getByLabelText('Units'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          unitCount: 2,
          units: [expect.objectContaining({ id: 'unit-1', count: 2, size: 'Medium' })],
        })
      );
    });
  });

  it('creates a room with multiple supported species', async () => {
    roomService.createRoom.mockResolvedValue({});

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Shared Ward' },
    });
    fireEvent.click(screen.getByLabelText('Species'));
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          availability: expect.objectContaining({
            species: ['CANINE', 'FELINE'],
          }),
        })
      );
    });
  });
});
