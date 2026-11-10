import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { registerPrivateCleanup } from "../../lib/privateSession";
export type Photo = {
  id: string;
  uploader_id: string;
  album_id: string | null;
  description: string;
  event_date: string;
  created_at: string;
  storage_path: string;
  version: number;
  width: number;
  height: number;
  storage_missing: boolean;
};
export type Album = {
  id: string;
  creator_id: string;
  title: string;
  version: number;
};
export function useGallery(coupleId: string, albumId: string) {
  const [photos, setPhotos] = useState<Photo[]>([]),
    [albums, setAlbums] = useState<Album[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [more, setMore] = useState(false);
  const sequence = useRef(0);
  async function load(append = false) {
    const request = ++sequence.current;
    setLoading(true);
    setError(false);
    let query = supabase().from("photos").select(
      "id,uploader_id,album_id,description,event_date,created_at,storage_path,version,width,height,storage_missing",
    ).eq("couple_id", coupleId).order("event_date", { ascending: false }).order(
      "created_at",
      { ascending: false },
    ).order("id", { ascending: false }).limit(30);
    if (albumId === "none") query = query.is("album_id", null);
    else if (albumId) query = query.eq("album_id", albumId);
    const cursor = append ? photos.at(-1) : undefined;
    if (cursor) {
      query = query.or(
        `event_date.lt.${cursor.event_date},and(event_date.eq.${cursor.event_date},created_at.lt.${cursor.created_at}),and(event_date.eq.${cursor.event_date},created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
      );
    }
    const [images, collections] = await Promise.all([
      query,
      supabase().from("albums").select("id,creator_id,title,version").eq(
        "couple_id",
        coupleId,
      ).order("created_at", { ascending: false }),
    ]);
    if (request !== sequence.current) return;
    if (images.error || collections.error) setError(true);
    else {
      const records = images.data ?? [];
      setPhotos((old) => append ? [...old, ...records] : records);
      setAlbums(collections.data ?? []);
      setMore(records.length === 30);
    }
    setLoading(false);
  }
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
    };
  }, [coupleId, albumId]);
  useEffect(() =>
    registerPrivateCleanup(() => {
      sequence.current++;
      setPhotos([]);
      setAlbums([]);
      setLoading(false);
      setError(false);
    }), []);
  return {
    photos,
    albums,
    loading,
    error,
    more,
    reload: () => load(),
    loadMore: () => load(true),
  };
}
