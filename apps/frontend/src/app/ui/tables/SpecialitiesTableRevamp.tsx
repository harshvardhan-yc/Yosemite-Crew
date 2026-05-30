import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import SpecialitiesCard from '@/app/ui/cards/SpecialitiesCard';
import { Column, NoDataMessage, ViewButton, ProfileTitle } from '@/app/ui/tables/common';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useShallow } from 'zustand/react/shallow';
import { getSafeImageUrl } from '@/app/lib/urls';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';

import './DataTable.css';

type SpecialitiesTableRevampProps = {
  filteredList: SpecialityWeb[];
  onManageTeam: (speciality: SpecialityWeb) => void;
};

const SpecialitiesTableRevamp = ({ filteredList, onManageTeam }: SpecialitiesTableRevampProps) => {
  const allServices = useRevampCatalogStore(useShallow((s) => s.services));
  const allPackages = useRevampCatalogStore(useShallow((s) => s.packages));
  const teams = useTeamForPrimaryOrg();

  const getRevampId = (item: SpecialityWeb): string =>
    (item as SpecialityWeb & { revampId?: string }).revampId ?? item._id ?? '';

  const columns: Column<SpecialityWeb>[] = [
    {
      label: 'Speciality',
      key: 'Speciality',
      width: '30%',
      render: (item: SpecialityWeb) => {
        const id = getRevampId(item);
        const openParam = id ? `?open=${id}` : '';
        return (
          <Link
            href={`/organization/specialities${openParam}`}
            className="appointment-profile-title hover:underline! text-text-primary cursor-pointer"
          >
            {item.name}
          </Link>
        );
      },
    },
    {
      label: 'Services',
      key: 'Services',
      width: '100px',
      render: (item: SpecialityWeb) => {
        const id = getRevampId(item);
        const count = id
          ? allServices.filter((s) => s.specialityId === id && s.status === 'ACTIVE').length
          : (item.services?.length ?? 0);
        return <ProfileTitle>{count}</ProfileTitle>;
      },
    },
    {
      label: 'Packages',
      key: 'Packages',
      width: '100px',
      render: (item: SpecialityWeb) => {
        const id = getRevampId(item);
        const count = id
          ? allPackages.filter((p) => p.specialityId === id && p.status === 'ACTIVE').length
          : 0;
        return <ProfileTitle>{count}</ProfileTitle>;
      },
    },
    {
      label: 'Head',
      key: 'Head',
      width: '28%',
      render: (item: SpecialityWeb) => {
        if (!item.headName) return <ProfileTitle>{'—'}</ProfileTitle>;
        const headTeam = teams?.find((t) => t.practionerId === item.headUserId);
        const picUrl = headTeam?.image ?? item.headProfilePicUrl;
        return (
          <div className="appointment-profile">
            <Image
              src={getSafeImageUrl(picUrl, 'person')}
              alt={item.headName}
              width={36}
              height={36}
              className="size-9 rounded-full object-cover shrink-0"
            />
            <div className="appointment-profile-two min-w-0">
              <div className="appointment-profile-title truncate">{item.headName}</div>
            </div>
          </div>
        );
      },
    },
    {
      label: 'Team members',
      key: 'Team members',
      width: '120px',
      render: (item: SpecialityWeb) => (
        <ProfileTitle>{item.teamMemberIds?.length ?? 0}</ProfileTitle>
      ),
    },
    {
      label: 'Actions',
      key: 'actions',
      width: '80px',
      render: (item: SpecialityWeb) => (
        <div className="action-btn-col">
          <ViewButton onClick={() => onManageTeam(item)} />
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      <div className="hidden xl:flex">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={5}
          tableClassName="specialities-table"
        />
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {filteredList.length === 0 ? (
          <NoDataMessage />
        ) : (
          filteredList.map((item, i) => (
            <SpecialitiesCard
              key={(item.name ?? '') + i}
              speciality={item}
              handleViewSpeciality={() => onManageTeam(item)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default SpecialitiesTableRevamp;
