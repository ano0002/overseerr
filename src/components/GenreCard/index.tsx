import CachedImage from '@app/components/Common/CachedImage';
import { withProperties } from '@app/utils/typeHelpers';
import Link from 'next/link';
import { useState } from 'react';

interface GenreCardProps {
  name: string;
  image: string;
  url: string;
  canExpand?: boolean;
}

const GenreCard = ({ image, url, name, canExpand = false }: GenreCardProps) => {
  const [isHovered, setHovered] = useState(false);

  return (
    <Link
      href={url}
      className={`relative flex h-32 items-center justify-center sm:h-36 ${
        canExpand ? 'w-full' : 'w-56 sm:w-72'
      } transform-gpu cursor-pointer p-8 shadow ring-1 transition duration-300 ease-in-out ${
        isHovered
          ? 'scale-105 bg-gray-700 bg-opacity-100 ring-gray-500'
          : 'scale-100 bg-gray-800 bg-opacity-80 ring-gray-700'
      } overflow-hidden rounded-xl bg-cover bg-center`}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          setHovered(true);
        }
      }}
      role="link"
      tabIndex={0}
    >
      <CachedImage src={image} alt="" layout="fill" objectFit="cover" />
      <div
        className={`absolute inset-0 z-10 h-full w-full bg-gray-800 transition duration-300 ${
          isHovered ? 'bg-opacity-10' : 'bg-opacity-30'
        }`}
      />
      <div className="relative z-20 w-full truncate whitespace-normal text-center text-2xl font-bold text-white sm:text-3xl">
        {name}
      </div>
    </Link>
  );
};

const GenreCardPlaceholder = () => {
  return (
    <div
      className={`relative h-32 w-56 animate-pulse rounded-xl bg-gray-700 sm:h-40 sm:w-72`}
    ></div>
  );
};

export default withProperties(GenreCard, { Placeholder: GenreCardPlaceholder });
