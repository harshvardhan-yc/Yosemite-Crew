import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RoomCard from '@/app/ui/cards/RoomCard';
import { OrganisationRoom } from '@yosemite-crew/types';

// --- Mocks ---

// Mock helper function from RoomTable
jest.mock('@/app/ui/tables/tableUtils', () => ({
  joinNames: jest.fn((map, ids) => {
    if (!ids || ids.length === 0) return '-';
    return ids
      .map((item: any) =>
        typeof item === 'string' ? map[item] || item : item.name || map[item.id]
      )
      .join(', ');
  }),
}));

import { joinNames } from '@/app/ui/tables/tableUtils';

// --- Test Data ---

const mockRoom: OrganisationRoom = {
  _id: 'room-101',
  name: 'Surgery Room A',
  type: 'Surgery',
  code: 'SRG-101',
  // Note: Using spelling from source code interface
  assignedSpecialiteis: [
    { id: 'spec-1', name: 'Orthopedics' },
    { id: 'spec-2', name: 'General' },
  ],
  assignedStaffs: [{ id: 'staff-1', name: 'Dr. Strange' }],
} as any;

const mockSpecialityMap = {
  'spec-1': 'Orthopedics',
  'spec-2': 'General',
};

const mockStaffMap = {
  'staff-1': 'Dr. Strange',
};

describe('RoomCard Component', () => {
  const mockHandleView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Details ---

  it('renders room information correctly', () => {
    render(
      <RoomCard
        room={mockRoom}
        handleViewRoom={mockHandleView}
        specialityNameById={mockSpecialityMap}
        staffNameById={mockStaffMap}
      />
    );

    // Title & Type
    expect(screen.getByText('Surgery Room A')).toBeInTheDocument();
    expect(screen.getByText('Type:')).toBeInTheDocument();
    expect(screen.getByText('Surgery')).toBeInTheDocument();

    // Verify helper function calls
    expect(joinNames).toHaveBeenCalledWith(mockSpecialityMap, mockRoom.assignedSpecialiteis);
    expect(joinNames).toHaveBeenCalledWith(mockStaffMap, mockRoom.assignedStaffs);

    // Verify Rendered output from helper
    expect(screen.getByText('Orthopedics, General')).toBeInTheDocument();
    expect(screen.getByText('Dr. Strange')).toBeInTheDocument();
  });

  // --- 2. Interaction ---

  it('calls handleViewRoom with room object when View button is clicked', () => {
    render(
      <RoomCard
        room={mockRoom}
        handleViewRoom={mockHandleView}
        specialityNameById={mockSpecialityMap}
        staffNameById={mockStaffMap}
      />
    );

    const viewBtn = screen.getByText('View');
    fireEvent.click(viewBtn);

    expect(mockHandleView).toHaveBeenCalledTimes(1);
    expect(mockHandleView).toHaveBeenCalledWith(mockRoom);
  });

  // --- 3. Edge Cases ---

  it('handles empty assignments gracefully (via helper mock)', () => {
    const emptyRoom = {
      ...mockRoom,
      assignedSpecialiteis: [],
      assignedStaffs: [],
    } as any;

    render(
      <RoomCard
        room={emptyRoom}
        handleViewRoom={mockHandleView}
        specialityNameById={mockSpecialityMap}
        staffNameById={mockStaffMap}
      />
    );

    // Our mock returns "-" for empty arrays
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
