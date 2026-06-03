import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import RoomInfo from '@/app/features/organization/pages/Organization/Sections/Rooms/RoomInfo';

const updateRoomMock = jest.fn();
const deleteRoomMock = jest.fn();
const accordionCalls: any[] = [];

jest.mock('@/app/features/organization/services/roomService', () => ({
  updateRoom: (...args: any[]) => updateRoomMock(...args),
  deleteRoom: (...args: any[]) => deleteRoomMock(...args),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => [{ _id: 'team-1', name: 'Alex' }],
}));

jest.mock('@/app/hooks/useSpecialities', () => ({
  useSpecialitiesForPrimaryOrg: () => [{ _id: 'spec-1', name: 'Surgery' }],
}));

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('@/app/ui/primitives/Accordion/EditableAccordion', () => (props: any) => {
  accordionCalls.push(props);
  return <div data-testid="room-accordion" />;
});

describe('RoomInfo modal', () => {
  const activeRoom: any = {
    id: 'room-1',
    organisationId: 'org-1',
    name: 'Room A',
    type: 'EXAM',
    assignedSpecialiteis: [],
    assignedStaffs: [],
    unitCount: 1,
    units: [{ id: 'unit-a', name: 'A', occupied: true }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    accordionCalls.length = 0;
  });

  it('updates room on save', async () => {
    render(<RoomInfo showModal setShowModal={jest.fn()} activeRoom={activeRoom} canEditRoom />);

    await accordionCalls[0].onSave({
      name: 'Updated',
      type: 'EXAM',
      assignedSpecialiteis: [],
      assignedStaffs: [],
      unitCount: 2,
    });

    expect(updateRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'room-1',
        organisationId: 'org-1',
        name: 'Updated',
        unitCount: 2,
        units: [
          { id: 'unit-a', name: 'A', occupied: true },
          { id: 'unit-2', name: '2', occupied: false },
        ],
      })
    );
  });

  it('passes unit count into the editable accordion', () => {
    render(<RoomInfo showModal setShowModal={jest.fn()} activeRoom={activeRoom} canEditRoom />);

    expect(accordionCalls[0].fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'unitCount', label: 'Unit / pod count' }),
      ])
    );
    expect(accordionCalls[0].data.unitCount).toBe(1);
  });
});
