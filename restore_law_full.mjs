import {createClient} from '@supabase/supabase-js';
import {loadEnvFile} from 'node:process';
loadEnvFile('.env.local');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {auth:{persistSession:false}});

async function restore() {
  const {data: law} = await db.from('programs').select('*').eq('slug','law').single();
  console.log('Current law version:', law.version);
  
  // Static law program data from data/programs.ts
  const curriculum = [
    "مبادئ القانون", "القانون الإداري", "القانون الجزائي العام", "المدخل للفقه الإسلامي",
    "أحكام الضمان", "مصادر الالتزام", "أحكام الأسرة", "القانون التجاري",
    "نظام القضاء والإثبات", "أحكام الالتزام", "العقود الإدارية", "إجراءات التقاضي",
    "القانون الجزائي الخاص", "العقود المدنية", "نظام الزكاة والضرائب", "قانون التنفيذ",
    "العقود التجارية وعمليات البنوك", "أحكام الملكية والأموال", "الأوراق التجارية",
    "قانون العمل والتأمينات الاجتماعية", "الإجراءات الجزائية", "الإفلاس وطرق تسويته",
    "التحكيم التجاري"
  ];
  
  const careers = [
    "مساعد باحث قانوني", "مساعد محامي", "مساعد باحث قضايا", "مساعد مفتش قانوني",
    "مساعد مفتش إداري", "مساعد باحث أنظمة", "سكرتير قانوني", "مساعد مراقب تجاري",
    "مساعد مراقب جمركي", "مدقق جمركي", "مدقق طلبات", "مساعد إداري", "كاتب"
  ];
  
  console.log('Static curriculum:', curriculum.length);
  console.log('Static careers:', careers.length);
  
  const programJson = {
    image_path: '/diploms_photos/القانون.png',
    name_ar: law.name_ar,
    name_en: law.name_en,
    slug: law.slug,
    program_type: law.program_type,
    specialization: law.specialization,
    searchable_keywords: law.searchable_keywords,
    description: law.description,
    duration_display: law.duration_display,
    duration_standard: law.duration_standard,
    duration_summer: law.duration_summer,
    accredited_hours: law.accredited_hours,
    accreditation_text: law.accreditation_text,
    image_position: law.image_position,
    content_pending: law.content_pending,
    classification_pending: law.classification_pending,
    is_active: law.is_active,
    publication_status: law.publication_status,
    catalog_visibility: law.catalog_visibility,
    is_featured: law.is_featured
  };
  
  const {data, error} = await db.rpc('legacy_admin_save_program', {
    p_id: law.id,
    p_expected_version: law.version,
    p_program: programJson,
    p_curriculum: curriculum.map(title => ({title})),
    p_careers: careers.map(title => ({title})),
    p_archive: 'keep',
    p_actor_username: 'admin',
    p_actor_name: 'مدير النظام',
    p_request_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  });
  console.log('Restore result:', error || 'Success');
  
  const {data: law2} = await db.from('programs').select('*').eq('slug','law').single();
  const {data: curr2} = await db.from('curriculum_items').select('*').eq('program_id', law.id).order('sort_order');
  const {data: carr2} = await db.from('career_paths').select('*').eq('program_id', law.id).order('sort_order');
  console.log('Law after:', {id: law2.id, image: law2.image_path, version: law2.version, curriculum: curr2?.length, careers: carr2?.length});
}

restore().catch(e => { console.error(e); process.exit(1); });