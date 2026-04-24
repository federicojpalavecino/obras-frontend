import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bomxksdisszrhhsctowd.supabase.co";
const SUPABASE_KEY = "sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
export default sb;
